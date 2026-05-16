'use strict';

const LOG_API_URL = 'http://4.224.186.213/evaluation-service/logs';

const ALLOWED_STACKS = new Set(['backend', 'frontend']);
const ALLOWED_LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const ALLOWED_PACKAGES = new Set([
  'cache',
  'controller',
  'cron_job',
  'db',
  'domain',
  'handler',
  'repository',
  'route',
  'service',
  'api',
  'component',
  'hook',
  'page',
  'state',
  'style',
  'auth',
  'config',
  'middleware',
  'utils'
]);

function buildAuthorizationHeader() {
  if (process.env.AUTHORIZATION_HEADER) {
    return process.env.AUTHORIZATION_HEADER;
  }

  if (process.env.EVALUATION_API_TOKEN) {
    return `Bearer ${process.env.EVALUATION_API_TOKEN}`;
  }

  throw new Error('Missing logging authorization. Set EVALUATION_API_TOKEN or AUTHORIZATION_HEADER.');
}

function validateLogInput(stack, level, logPackage, message) {
  if (!ALLOWED_STACKS.has(stack)) {
    throw new Error(`Unsupported log stack: ${stack}`);
  }

  if (!ALLOWED_LEVELS.has(level)) {
    throw new Error(`Unsupported log level: ${level}`);
  }

  if (!ALLOWED_PACKAGES.has(logPackage)) {
    throw new Error(`Unsupported log package: ${logPackage}`);
  }

  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Log message must be a non-empty string.');
  }
}

async function Log(stack, level, logPackage, message) {
  validateLogInput(stack, level, logPackage, message);

  const response = await fetch(LOG_API_URL, {
    method: 'POST',
    headers: {
      Authorization: buildAuthorizationHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      stack,
      level,
      package: logPackage,
      message
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Log API failed: ${response.status} ${response.statusText} ${responseText}`);
  }

  return response.json();
}

async function safeLog(stack, level, logPackage, message) {
  try {
    return await Log(stack, level, logPackage, message);
  } catch (error) {
    // Logging must never turn a successful user flow into a failed request.
    console.error(`Log delivery skipped: ${error.message}`);
    return null;
  }
}

module.exports = {
  Log,
  safeLog
};
