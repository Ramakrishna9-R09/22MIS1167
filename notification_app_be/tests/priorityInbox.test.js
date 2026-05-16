'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  findTopNotificationsByHeap,
  findTopNotificationsBySort,
  rankNotification
} = require('../priorityInbox');

test('placement notifications outrank newer result and event notifications', () => {
  const rankedNotification = rankNotification({
    ID: 'placement-old',
    Type: 'Placement',
    Message: 'Hiring update',
    Timestamp: '2026-04-22 10:00:00'
  });

  const newerResult = rankNotification({
    ID: 'result-new',
    Type: 'Result',
    Message: 'Exam result',
    Timestamp: '2026-05-16 10:00:00'
  });

  assert.ok(rankedNotification.score > newerResult.score);
});

test('sort and heap strategies return the same top notification ids', () => {
  const notifications = [
    { ID: 'event-a', Type: 'Event', Message: 'Tech fest', Timestamp: '2026-05-16 09:00:00' },
    { ID: 'placement-a', Type: 'Placement', Message: 'Hiring A', Timestamp: '2026-05-16 08:00:00' },
    { ID: 'result-a', Type: 'Result', Message: 'Result A', Timestamp: '2026-05-16 10:00:00' },
    { ID: 'placement-b', Type: 'Placement', Message: 'Hiring B', Timestamp: '2026-05-16 11:00:00' },
    { ID: 'event-b', Type: 'Event', Message: 'Workshop', Timestamp: '2026-05-16 12:00:00' }
  ];

  const sortedTopIds = findTopNotificationsBySort(notifications, 3).map((notification) => notification.id);
  const heapTopIds = findTopNotificationsByHeap(notifications, 3).map((notification) => notification.id);

  assert.deepEqual(heapTopIds, sortedTopIds);
});

test('rejects unknown notification types', () => {
  assert.throws(
    () =>
      rankNotification({
        ID: 'unknown-type',
        Type: 'Circular',
        Message: 'General update',
        Timestamp: '2026-05-16 12:00:00'
      }),
    /Unknown notification type/
  );
});
