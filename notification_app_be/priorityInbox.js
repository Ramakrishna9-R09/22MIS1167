'use strict';

const API_BASE_URL = 'http://4.224.186.213/evaluation-service';
const TOP_NOTIFICATION_LIMIT = 10;
const TYPE_WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1
};

class MinHeap {
  constructor(maxSize) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error('Heap max size must be a positive integer.');
    }

    this.maxSize = maxSize;
    this.priorityItems = [];
  }

  add(priorityItem) {
    if (this.priorityItems.length < this.maxSize) {
      this.priorityItems.push(priorityItem);
      this.heapifyUp(this.priorityItems.length - 1);
      return;
    }

    if (priorityItem.score <= this.priorityItems[0].score) {
      return;
    }

    this.priorityItems[0] = priorityItem;
    this.heapifyDown(0);
  }

  toSortedDescending() {
    return [...this.priorityItems].sort((leftNotification, rightNotification) => {
      return rightNotification.score - leftNotification.score;
    });
  }

  heapifyUp(startIndex) {
    let currentIndex = startIndex;

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);

      if (this.priorityItems[parentIndex].score <= this.priorityItems[currentIndex].score) {
        break;
      }

      this.swap(parentIndex, currentIndex);
      currentIndex = parentIndex;
    }
  }

  heapifyDown(startIndex) {
    let currentIndex = startIndex;

    while (currentIndex < this.priorityItems.length) {
      const leftChildIndex = currentIndex * 2 + 1;
      const rightChildIndex = currentIndex * 2 + 2;
      let smallestIndex = currentIndex;

      if (
        leftChildIndex < this.priorityItems.length &&
        this.priorityItems[leftChildIndex].score < this.priorityItems[smallestIndex].score
      ) {
        smallestIndex = leftChildIndex;
      }

      if (
        rightChildIndex < this.priorityItems.length &&
        this.priorityItems[rightChildIndex].score < this.priorityItems[smallestIndex].score
      ) {
        smallestIndex = rightChildIndex;
      }

      if (smallestIndex === currentIndex) {
        break;
      }

      this.swap(currentIndex, smallestIndex);
      currentIndex = smallestIndex;
    }
  }

  swap(leftIndex, rightIndex) {
    const leftItem = this.priorityItems[leftIndex];
    this.priorityItems[leftIndex] = this.priorityItems[rightIndex];
    this.priorityItems[rightIndex] = leftItem;
  }
}

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

async function fetchNotifications() {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    method: 'GET',
    headers: {
      Authorization: buildAuthorizationHeader(),
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Notification API request failed: ${response.status} ${response.statusText} ${responseText}`
    );
  }

  const notificationPayload = await response.json();

  if (!Array.isArray(notificationPayload.notifications)) {
    throw new Error('Notification API response did not include a notifications array.');
  }

  return notificationPayload.notifications;
}

function parseTimestamp(timestampValue) {
  const normalisedTimestamp = String(timestampValue).replace(' ', 'T');
  const timestampMs = Date.parse(normalisedTimestamp);

  if (!Number.isFinite(timestampMs)) {
    throw new Error(`Invalid notification timestamp received: ${timestampValue}`);
  }

  return timestampMs;
}

function rankNotification(rawNotification) {
  const notificationType = rawNotification.Type;
  const typeWeight = TYPE_WEIGHTS[notificationType];

  if (!typeWeight) {
    throw new Error(`Unknown notification type received: ${notificationType}`);
  }

  const timestampMs = parseTimestamp(rawNotification.Timestamp);

  return {
    id: rawNotification.ID,
    type: notificationType,
    message: rawNotification.Message,
    timestamp: rawNotification.Timestamp,
    score: typeWeight * 10 ** 12 + timestampMs
  };
}

function findTopNotificationsBySort(rawNotifications, limit = TOP_NOTIFICATION_LIMIT) {
  return rawNotifications
    .map(rankNotification)
    .sort((leftNotification, rightNotification) => rightNotification.score - leftNotification.score)
    .slice(0, limit);
}

async function fetchPriorityNotifications(limit = TOP_NOTIFICATION_LIMIT) {
  const notifications = await fetchNotifications();
  const topNotifications = findTopNotificationsBySort(notifications, limit);

  return {
    notifications,
    topNotifications
  };
}

function findTopNotificationsByHeap(rawNotifications, limit = TOP_NOTIFICATION_LIMIT) {
  const priorityHeap = new MinHeap(limit);

  rawNotifications.forEach((rawNotification) => {
    priorityHeap.add(rankNotification(rawNotification));
  });

  return priorityHeap.toSortedDescending();
}

function printTopNotifications(priorityNotifications) {
  priorityNotifications.forEach((notification, index) => {
    console.log(
      `${index + 1}. ${notification.type} | ${notification.message} | ${notification.timestamp} | score=${notification.score}`
    );
  });
}

async function runPriorityInbox() {
  const notifications = await fetchNotifications();
  const topNotifications = findTopNotificationsBySort(notifications);
  const streamingTopNotifications = findTopNotificationsByHeap(notifications);

  console.log('Top 10 priority notifications');
  printTopNotifications(topNotifications);
  console.log('');
  console.log('Top 10 maintained with fixed-size min-heap');
  printTopNotifications(streamingTopNotifications);
}

if (require.main === module) {
  runPriorityInbox().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  fetchNotifications,
  fetchPriorityNotifications,
  MinHeap,
  findTopNotificationsByHeap,
  findTopNotificationsBySort,
  rankNotification
};
