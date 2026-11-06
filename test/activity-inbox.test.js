import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getInitialActivitySeenAt,
    getNewestActivityTimestamp,
    getUnseenActivities
} from '../activity-inbox.js';

const activities = [
    { id: 'old', createdAt: '2026-11-06T10:00:00.000Z' },
    { id: 'newer', createdAt: '2026-11-06T10:03:00.000Z' },
    { id: 'newest', createdAt: '2026-11-06T10:05:00.000Z' },
    { id: 'invalid', createdAt: 'not-a-date' }
];

test('returns only unseen activities ordered from newest to oldest', () => {
    assert.deepEqual(
        getUnseenActivities(activities, '2026-11-06T10:01:00.000Z').map(activity => activity.id),
        ['newest', 'newer']
    );
});

test('returns no activities when the seen timestamp is missing or invalid', () => {
    assert.deepEqual(getUnseenActivities(activities, null), []);
    assert.deepEqual(getUnseenActivities(activities, 'not-a-date'), []);
});

test('finds the newest valid activity timestamp for marking the inbox as seen', () => {
    assert.equal(getNewestActivityTimestamp(activities), '2026-11-06T10:05:00.000Z');
    assert.equal(getNewestActivityTimestamp([{ id: 'invalid', createdAt: 'not-a-date' }]), null);
});

test('initializes a new device before its oldest loaded activity', () => {
    assert.equal(
        getInitialActivitySeenAt(activities),
        '2026-11-06T09:59:59.999Z'
    );
    assert.equal(
        getInitialActivitySeenAt([], '2026-11-06T10:10:00.000Z'),
        '2026-11-06T10:10:00.000Z'
    );
});
