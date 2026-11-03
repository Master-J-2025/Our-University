import test from 'node:test';
import assert from 'node:assert/strict';
import { getDateOccurrence, getDaysUntilDate, getTodayInTimezone } from '../supabase/functions/_shared/calendar.js';

test('uses the couple timezone when determining the local calendar day', () => {
    const instant = new Date('2025-01-01T01:00:00.000Z');
    assert.equal(getTodayInTimezone(instant, 'America/Los_Angeles'), '2024-12-31');
});

test('falls back to UTC for an invalid timezone', () => {
    const instant = new Date('2025-01-01T01:00:00.000Z');
    assert.equal(getTodayInTimezone(instant, 'not/a-timezone'), '2025-01-01');
});

test('selects the next occurrence of a recurring date', () => {
    assert.equal(getDateOccurrence('2024-05-10', '2025-05-11', true), '2026-05-10');
    assert.equal(getDateOccurrence('2000-02-29', '2025-02-20', true), '2028-02-29');
});

test('keeps a non-recurring date in its original year', () => {
    assert.equal(getDateOccurrence('2024-05-10', '2025-05-01', false), '2024-05-10');
});

test('calculates reminder windows across year boundaries', () => {
    assert.equal(getDaysUntilDate('2025-12-31', '2026-01-01'), 1);
    assert.equal(getDaysUntilDate('2025-12-25', '2026-01-01'), 7);
});

test('ignores malformed dates instead of normalizing them', () => {
    assert.equal(getDateOccurrence('2025-02-29', '2025-02-20', true), null);
    assert.equal(getDaysUntilDate('2025-02-30', '2025-03-01'), null);
});
