'use strict';

const { safeLog } = require('../logging_middleware/logger');

const API_BASE_URL = 'http://4.224.186.213/evaluation-service';

function buildAuthorizationHeader() {
  if (process.env.AUTHORIZATION_HEADER) {
    return process.env.AUTHORIZATION_HEADER;
  }

  if (process.env.EVALUATION_API_TOKEN) {
    return `Bearer ${process.env.EVALUATION_API_TOKEN}`;
  }

  throw new Error(
    'Missing API authorization. Set EVALUATION_API_TOKEN or AUTHORIZATION_HEADER before running.'
  );
}

async function fetchEvaluationResource(resourcePath) {
  await safeLog('backend', 'info', 'service', `Fetching evaluation resource ${resourcePath}.`);

  const response = await fetch(`${API_BASE_URL}${resourcePath}`, {
    method: 'GET',
    headers: {
      Authorization: buildAuthorizationHeader(),
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Evaluation API request failed for ${resourcePath}: ${response.status} ${response.statusText} ${responseText}`
    );
  }

  return response.json();
}

async function fetchDepots() {
  const depotPayload = await fetchEvaluationResource('/depots');

  if (!Array.isArray(depotPayload.depots)) {
    throw new Error('Depot API response did not include a depots array.');
  }

  return depotPayload.depots;
}

async function fetchVehicles() {
  const vehiclePayload = await fetchEvaluationResource('/vehicles');

  if (!Array.isArray(vehiclePayload.vehicles)) {
    throw new Error('Vehicles API response did not include a vehicles array.');
  }

  return vehiclePayload.vehicles;
}

module.exports = {
  fetchDepots,
  fetchVehicles
};
