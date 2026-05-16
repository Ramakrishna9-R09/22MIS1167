# Vehicle Maintenance Scheduler

This service fetches depot budgets and live maintenance tasks from the evaluation APIs, then runs a bottom-up 0/1 knapsack algorithm for every depot.

## Files

- `index.js` wires the API calls to the scheduler and prints the output.
- `server.js` exposes a local API for API-client screenshots.
- `fetchData.js` fetches depots and vehicles with the required authorization header.
- `scheduler.js` contains the dynamic programming scheduler and backtracking logic.

## Run

Use Node.js 18 or later because the code uses the built-in `fetch` API.

```bash
cd vehicle_maintenance_scheduler
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
GET http://localhost:3001/api/v1/maintenance-schedules
```

To run the original console format:

```bash
npm run cli
```

## Sample output

```text
Depot 1 (Budget: 60h)
  Selected tasks: [264e638f-1c7a-4d67-9f9c-53f3d1766d37, 08000114-9506-463d-ba2e-3343ec4e2e89]
  Total duration: 58h
  Total impact: 47
---
Depot 2 (Budget: 135h)
  Selected tasks: [TaskID1, TaskID2, TaskID3]
  Total duration: 132h
  Total impact: 103
---
```

The actual task IDs and scores depend on the live API response at run time.
