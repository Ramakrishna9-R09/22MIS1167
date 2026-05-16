'use strict';

const express = require('express');
const {
  fetchPriorityNotifications,
  findTopNotificationsByHeap
} = require('./priorityInbox');
const { safeLog } = require('../logging_middleware/logger');

const PORT = Number(process.env.PORT || 3002);
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const app = express();

app.use(express.json({ limit: '64kb' }));

app.get('/health', (request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'notification-priority-inbox'
  });
});

app.get('/api/v1/priority-inbox', async (request, response) => {
  const requestStartedAt = Date.now();
  const requestedLimit = Number(request.query.limit || DEFAULT_LIMIT);

  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_LIMIT) {
    response.status(400).json({
      error: {
        code: 'INVALID_LIMIT',
        message: `limit must be an integer between 1 and ${MAX_LIMIT}.`
      },
      meta: {
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
    return;
  }

  try {
    await safeLog('backend', 'info', 'route', 'Received priority inbox request.');

    const { notifications, topNotifications } = await fetchPriorityNotifications(requestedLimit);
    const heapMaintainedTop = findTopNotificationsByHeap(notifications, requestedLimit);

    await safeLog(
      'backend',
      'info',
      'service',
      `Ranked ${notifications.length} notifications for priority inbox.`
    );

    response.status(200).json({
      data: topNotifications,
      meta: {
        requestedLimit,
        notificationCount: notifications.length,
        streamingStrategy: 'fixed-size min-heap',
        heapMatchesSort:
          JSON.stringify(heapMaintainedTop.map((notification) => notification.id)) ===
          JSON.stringify(topNotifications.map((notification) => notification.id)),
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
  } catch (error) {
    await safeLog('backend', 'error', 'handler', `Priority inbox request failed: ${error.message}`);

    response.status(500).json({
      error: {
        code: 'PRIORITY_INBOX_FAILED',
        message: error.message
      },
      meta: {
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
  }
});

app.use((request, response) => {
  response.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found.'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Notification priority inbox API listening on http://localhost:${PORT}`);
});
