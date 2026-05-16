# Backend Assessment Submission

This repository contains the backend-track deliverables for the assessment. The implementation is organised as independent services and design artifacts so each question can be evaluated separately.

## Repository Structure

```text
.
+-- logging_middleware/
+-- vehicle_maintenance_scheduler/
+-- notification_app_be/
+-- notification_system_design.md
+-- api_collection.json
+-- SUBMISSION_CHECKLIST.md
+-- .env.example
+-- .gitignore
```

## Modules

### `logging_middleware/`

Reusable logging client that sends structured logs to the protected logging API.

Exported functions:

- `Log(stack, level, package, message)`
- `safeLog(stack, level, package, message)`

`safeLog` is used by the backend services so logging failures do not break the main application flow.

### `vehicle_maintenance_scheduler/`

Express backend for the vehicle maintenance scheduling problem.

Responsibilities:

- Fetch depots from the protected depot API.
- Fetch vehicle maintenance tasks from the protected vehicles API.
- Run bottom-up 0/1 knapsack dynamic programming for each depot.
- Backtrack through the DP table to recover selected task IDs.
- Return schedules through a local API and support CLI output.

Local endpoint:

```text
GET http://localhost:3001/api/v1/maintenance-schedules
```

### `notification_system_design.md`

Markdown design document covering all six notification-system stages:

- REST API contracts
- Database choice and schema
- Query analysis and indexing
- Caching strategy
- Queue-based notification delivery redesign
- Priority inbox approach

### `notification_app_be/`

Express backend for the priority inbox problem.

Responsibilities:

- Fetch notifications from the protected notification API.
- Compute priority scores using notification type and timestamp.
- Return top 10 notifications by sorting.
- Maintain a fixed-size min-heap implementation for streaming top-10 updates.

Local endpoint:

```text
GET http://localhost:3002/api/v1/priority-inbox?limit=10
```

## Environment Variables

The protected APIs require authorization. Set one of the following before running the services:

```powershell
$env:EVALUATION_API_TOKEN = "your-access-token"
```

or:

```powershell
$env:AUTHORIZATION_HEADER = "Bearer your-access-token"
```

Secrets are intentionally excluded from the repository.

## Running Locally

Run the vehicle maintenance scheduler:

```powershell
cd vehicle_maintenance_scheduler
npm install
npm start
```

Run the priority inbox backend:

```powershell
cd notification_app_be
npm install
npm start
```

CLI alternatives:

```powershell
cd vehicle_maintenance_scheduler
npm run cli
```

```powershell
cd notification_app_be
npm run cli
```

## Verification Artifacts

Screenshots are included in:

```text
vehicle_maintenance_scheduler/screenshots/
notification_app_be/screenshots/
```

The local API collection is available at:

```text
api_collection.json
```

It contains the two local API requests used to verify the backend responses.

## Tests

Both runnable backend modules include Node built-in tests for their core logic.

```powershell
cd vehicle_maintenance_scheduler
npm test
```

```powershell
cd notification_app_be
npm test
```

## Notes

- Algorithms are implemented without external algorithm libraries.
- API credentials are read from environment variables only.
- The root `.gitignore` excludes `node_modules/`, `.env`, and `.DS_Store`.
- Backend services use Express for local API endpoints.
