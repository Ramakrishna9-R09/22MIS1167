'use strict';

const http = require('http');
const { URL } = require('url');
const {
  fetchPriorityNotifications,
  findTopNotificationsByHeap
} = require('./priorityInbox');
const { safeLog } = require('../logging_middleware/logger');

const PORT = Number(process.env.PORT || 3002);
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json'
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function handlePriorityInboxRequest(requestUrl, response) {
  const requestStartedAt = Date.now();
  const requestedLimit = Number(requestUrl.searchParams.get('limit') || DEFAULT_LIMIT);

  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_LIMIT) {
    sendJson(response, 400, {
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

    sendJson(response, 200, {
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

    sendJson(response, 500, {
      error: {
        code: 'PRIORITY_INBOX_FAILED',
        message: error.message
      },
      meta: {
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'notification-priority-inbox'
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/v1/priority-inbox') {
    await handlePriorityInboxRequest(requestUrl, response);
    return;
  }

  sendJson(response, 404, {
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found.'
    }
  });
});

server.listen(PORT, () => {
  console.log(`Notification priority inbox API listening on http://localhost:${PORT}`);
});
