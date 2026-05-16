# Campus Notifications Microservice Design

## Stage 1

### REST API contract

All endpoints use JSON and require the authenticated user context. Student routes should validate that the caller can only access their own notifications unless the caller has an admin role.

### Fetch notifications for a student

`GET /api/v1/students/{studentId}/notifications?page=1&pageSize=20&type=Placement&read=false`

Headers:

```json
{
  "Authorization": "Bearer <token>",
  "Accept": "application/json"
}
```

Response `200`:

```json
{
  "data": [
    {
      "notificationId": "uuid",
      "studentId": 1042,
      "type": "Placement",
      "title": "Campus hiring update",
      "message": "CSX Corporation hiring",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:18.000Z",
      "readAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 91,
    "totalPages": 5
  }
}
```

Status codes: `200`, `400` for invalid filters, `401`, `403`, `404`.

### Mark one notification as read

`PATCH /api/v1/students/{studentId}/notifications/{notificationId}/read`

Headers:

```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

Request body:

```json
{
  "isRead": true
}
```

Response `200`:

```json
{
  "notificationId": "uuid",
  "isRead": true,
  "readAt": "2026-05-16T10:12:00.000Z"
}
```

Status codes: `200`, `400`, `401`, `403`, `404`, `409` when the notification state changed concurrently.

### Bulk mark notifications as read

`PATCH /api/v1/students/{studentId}/notifications/read`

Headers:

```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

Request body:

```json
{
  "notificationIds": ["uuid-1", "uuid-2"]
}
```

Response `200`:

```json
{
  "updatedCount": 2,
  "readAt": "2026-05-16T10:12:00.000Z"
}
```

Status codes: `200`, `400`, `401`, `403`, `404`.

### Get unread count

`GET /api/v1/students/{studentId}/notifications/unread-count`

Headers:

```json
{
  "Authorization": "Bearer <token>",
  "Accept": "application/json"
}
```

Response `200`:

```json
{
  "studentId": 1042,
  "unreadCount": 17
}
```

Status codes: `200`, `401`, `403`, `404`.

### Create a notification

`POST /api/v1/admin/notifications`

Headers:

```json
{
  "Authorization": "Bearer <admin-token>",
  "Content-Type": "application/json"
}
```

Request body:

```json
{
  "studentIds": [1042, 1043],
  "type": "Placement",
  "title": "Campus hiring update",
  "message": "CSX Corporation hiring",
  "deliveryChannels": ["in_app", "email"]
}
```

Response `201`:

```json
{
  "batchId": "uuid",
  "createdCount": 2,
  "status": "queued"
}
```

Status codes: `201`, `400`, `401`, `403`, `422` for invalid type or recipients.

### Delete a notification

`DELETE /api/v1/students/{studentId}/notifications/{notificationId}`

Headers:

```json
{
  "Authorization": "Bearer <token>"
}
```

Response `204`: empty body.

Status codes: `204`, `401`, `403`, `404`.

### Real-time mechanism

Use WebSockets for logged-in dashboard sessions. Campus notifications need server-initiated delivery, unread count updates, and possible future acknowledgements from the client. WebSockets fit this better than polling because polling increases database and API load during placement season. SSE is simpler for one-way events, but WebSockets leave room for client acknowledgements and presence checks without adding a second channel.

The HTTP API remains the source of truth. WebSocket messages should only tell the client that a notification was created or changed, and the client can reconcile by fetching the latest page when needed.

## Stage 2

### Database choice

Use PostgreSQL. The notification platform has structured entities, clear relationships between students and notifications, strong consistency needs for read state, and query patterns that benefit from composite indexes. PostgreSQL also supports partitioning, enum types, JSONB metadata, and transactional inserts for notification batches.

### Schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');
CREATE TYPE delivery_channel AS ENUM ('in_app', 'email');
CREATE TYPE delivery_status AS ENUM ('queued', 'sent', 'failed');

CREATE TABLE students (
  student_id BIGINT PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_batches (
  batch_id UUID PRIMARY KEY,
  created_by BIGINT NOT NULL,
  notification_type notification_type NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY,
  batch_id UUID REFERENCES notification_batches(batch_id),
  student_id BIGINT NOT NULL REFERENCES students(student_id),
  notification_type notification_type NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE notification_deliveries (
  delivery_id UUID PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(notification_id),
  channel delivery_channel NOT NULL,
  status delivery_status NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_student_created
  ON notifications (student_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_student_unread_created
  ON notifications (student_id, is_read, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_type_created
  ON notifications (notification_type, created_at DESC)
  WHERE deleted_at IS NULL;
```

### Scaling risks and fixes

Large tables make scans, sorts, and count queries expensive. Partition `notifications` by month on `created_at`, archive old read notifications to cheaper storage, and use cursor pagination for deep result sets. Composite indexes should match the real filters: student timeline, unread count, and type/date analytics. Delivery records can grow faster than notifications, so keep retry history bounded and move old delivery logs to an audit table.

### Queries for Stage 1 endpoints

Fetch notifications:

```sql
SELECT notification_id, student_id, notification_type, title, message, is_read, created_at, read_at
FROM notifications
WHERE student_id = $1
  AND deleted_at IS NULL
  AND ($2::notification_type IS NULL OR notification_type = $2)
  AND ($3::boolean IS NULL OR is_read = $3)
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;
```

Mark one as read:

```sql
UPDATE notifications
SET is_read = true, read_at = now()
WHERE student_id = $1
  AND notification_id = $2
  AND deleted_at IS NULL
RETURNING notification_id, is_read, read_at;
```

Bulk mark as read:

```sql
UPDATE notifications
SET is_read = true, read_at = now()
WHERE student_id = $1
  AND notification_id = ANY($2::uuid[])
  AND deleted_at IS NULL;
```

Unread count:

```sql
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE student_id = $1
  AND is_read = false
  AND deleted_at IS NULL;
```

Create notification batch:

```sql
WITH new_batch AS (
  INSERT INTO notification_batches (batch_id, created_by, notification_type, title, message)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING batch_id, notification_type, title, message
)
INSERT INTO notifications (notification_id, batch_id, student_id, notification_type, title, message)
SELECT gen_random_uuid(), new_batch.batch_id, student_id, new_batch.notification_type, new_batch.title, new_batch.message
FROM new_batch
CROSS JOIN unnest($6::bigint[]) AS student_id;
```

Delete notification:

```sql
UPDATE notifications
SET deleted_at = now()
WHERE student_id = $1
  AND notification_id = $2
  AND deleted_at IS NULL;
```

## Stage 3

The intended query is:

```sql
SELECT *
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt DESC;
```

It is logically close, but it should avoid `SELECT *` in an API path. Returning every column increases I/O and can expose internal metadata. It should also use the actual database naming convention, such as `student_id`, `is_read`, and `created_at`.

At 5,000,000 rows, the query is slow when the database must scan many rows for `student_id` and `is_read`, then sort matching rows by `created_at`. Without a matching composite index, the cost trends toward `O(N log N)` because many rows can be scanned and sorted.

Create an index that matches the filter and ordering:

```sql
CREATE INDEX idx_notifications_unread_feed
  ON notifications (student_id, is_read, created_at DESC)
  WHERE deleted_at IS NULL;
```

Then query only the fields needed by the client:

```sql
SELECT notification_id, notification_type, title, message, created_at
FROM notifications
WHERE student_id = 1042
  AND is_read = false
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

After the fix, the database can use an index range scan for one student and unread state, already ordered by newest first. The likely cost becomes close to `O(log N + k)`, where `k` is the number of rows returned.

Indexing every column is not effective. Every index consumes storage, slows inserts and updates, and can confuse the query planner when many low-value indexes exist. Indexes should be designed around real filters, joins, ordering, and uniqueness constraints.

Students who received a Placement notification in the last 7 days:

```sql
SELECT DISTINCT student_id
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= now() - INTERVAL '7 days'
  AND deleted_at IS NULL;
```

## Stage 4

Redis is the best first cache for notification feeds and unread counts. Store the first page for active students with keys such as `student:{id}:notifications:page:1` and store unread counts at `student:{id}:unread_count`. The tradeoff is cache invalidation complexity: when a new notification arrives, a notification is read, or one is deleted, invalidate the affected feed pages and update the unread count. Short TTLs, such as 30 to 120 seconds, reduce stale data risk.

A CDN can cache public assets and static metadata, but it should not cache private per-student notification feeds unless the platform uses strict authenticated edge caching. The tradeoff is excellent latency for shared content but higher privacy risk for personalized data. It is useful for notification images, icons, and frontend bundles rather than the core feed.

In-memory caching inside the API process can reduce repeated work during traffic spikes, especially for type metadata and small computed response shapes. The tradeoff is that each instance has its own cache, so it becomes inconsistent across replicas. Use it only for short-lived values or as a local layer behind Redis.

Pagination should use cursor-based pagination instead of deep offsets. A cursor based on `(created_at, notification_id)` lets the database continue from the last item without counting or skipping thousands of rows. Lazy loading should fetch the first page immediately and older pages only when the student scrolls. Background sync can refresh unread counts and the first page after login without blocking the initial page render.

## Stage 5

The provided loop is slow and fragile because it sends email, writes the database row, and pushes the app event sequentially for every student. One slow email call blocks all remaining students. There is no retry policy, no dead-letter queue, no idempotency key, and no structured way to resume after partial failure.

If email failed for 200 students midway, the platform should not rerun the whole batch blindly. It should record per-student delivery status, enqueue retries for only failed email jobs, and use an idempotency key such as `batchId:studentId:email` so repeated attempts do not duplicate notifications.

Redesign the flow with a message queue such as BullMQ or RabbitMQ. The admin action creates a batch and enqueues jobs. Workers insert in-app notifications, send emails, and push WebSocket events concurrently with bounded retries and dead-letter handling.

Database save and email send should not be one distributed atomic transaction. The database and email provider cannot reliably share one transaction boundary. The safer design is to commit the notification and delivery intent to the database, then let workers attempt external delivery. This is an outbox-style approach: the system can retry external side effects without losing the source of truth.

Revised pseudocode:

```text
function notify_all(student_ids, message, notification_type):
  batch_id = create_notification_batch(message, notification_type)

  for student_id in student_ids:
    enqueue("create-notification", {
      idempotency_key: batch_id + ":" + student_id + ":in_app",
      batch_id,
      student_id,
      message,
      notification_type
    })

worker create_notification(job):
  if idempotency_key_already_processed(job.idempotency_key):
    return

  notification_id = save_notification(job.student_id, job.batch_id, job.message)
  enqueue("send-email", {
    idempotency_key: job.batch_id + ":" + job.student_id + ":email",
    notification_id,
    student_id: job.student_id,
    message: job.message
  })
  enqueue("push-websocket", {
    idempotency_key: job.batch_id + ":" + job.student_id + ":websocket",
    notification_id,
    student_id: job.student_id
  })

worker send_email(job):
  try up to 5 times with exponential backoff:
    send_email(job.student_id, job.message)
    mark_delivery_sent(job.notification_id, "email")
  on final failure:
    mark_delivery_failed(job.notification_id, "email")
    move_to_dead_letter_queue(job)

worker push_websocket(job):
  if student_is_online(job.student_id):
    push_to_app(job.student_id, job.notification_id)
  mark_delivery_sent(job.notification_id, "in_app")
```

## Stage 6

Priority Inbox ranks notifications by type first and recency second. The implemented score is:

```text
score = typeWeight * 10^12 + timestamp_ms
```

`Placement` has weight `3`, `Result` has weight `2`, and `Event` has weight `1`, so every Placement notification outranks every Result or Event notification. Within the same type, the larger timestamp wins because it is more recent.

For a fixed data set, sorting by score descending is simple and correct. For a stream of new notifications, maintain a min-heap of size 10. The heap keeps the current lowest-ranked item at the root. When a new notification arrives, push it if fewer than 10 items exist. Otherwise, compare its score with the root; replace the root only when the new notification has a higher score. This keeps memory at `O(10)` and each update at `O(log 10)`, which is effectively constant for this requirement.
