# Backend Assessment Submission

This repository contains the backend-track deliverables in the required folder structure.

## Folders

- `logging_middleware/` contains the reusable logging client.
- `vehicle_maintenance_scheduler/` contains the Vehicle Maintenance Scheduler local API and CLI.
- `notification_system_design.md` contains the notification design stages.
- `notification_app_be/` contains the priority inbox local API and CLI.

## Authentication

The evaluation APIs are protected. Set either `EVALUATION_API_TOKEN` or `AUTHORIZATION_HEADER` before running the services. Secrets are intentionally read from environment variables and are not committed.

## Suggested commit sequence

```text
init: repo structure and vehicle scheduler scaffold
feat: vehicle maintenance scheduler API fetch helpers
feat: vehicle maintenance scheduler knapsack DP algorithm
feat: vehicle maintenance scheduler backtracking for task IDs
feat: vehicle maintenance scheduler complete API wiring
docs: notification system Stage 1 API design
docs: notification system Stage 2 DB schema
docs: notification system Stage 3 query analysis
docs: notification system Stage 4 caching strategy
docs: notification system Stage 5 queue redesign
feat: stage6 priority scoring and top 10 logic
feat: stage6 min heap streaming implementation
docs: notification system Stage 6 explanation
chore: final cleanup and run instructions
```
