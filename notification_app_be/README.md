# Notification App Backend

This backend fetches notifications from the protected evaluation API, computes priority scores, returns the top notifications, and keeps a fixed-size min-heap implementation for streaming updates.

## Run

Use Node.js 18 or later because the code uses the built-in `fetch` API.

```bash
cd notification_app_be
$env:EVALUATION_API_TOKEN = "your-token-here"
npm start
```

If the test paper gives a complete authorization value instead of only a token, use:

```bash
$env:AUTHORIZATION_HEADER = "Bearer your-token-here"
npm start
```

The local API endpoint for screenshots is:

```text
GET http://localhost:3002/api/v1/priority-inbox?limit=10
```

To run the original console output:

```bash
npm run cli
```

## Output

The CLI prints two sections:

- Top 10 priority notifications computed by sorting all fetched notifications.
- Top 10 priority notifications maintained through a fixed-size min-heap.

Both sections should show the same ranking for the same API response.
