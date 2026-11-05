import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivityMessage } from '../supabase/functions/_shared/activity-message.js';

test('uses the database-provided activity message', () => {
    assert.equal(
        getActivityMessage({
            event_type: 'shared_change',
            details: { message: 'Ana agregó el recuerdo «Nuestro viaje».' }
        }),
        'Ana agregó el recuerdo «Nuestro viaje».'
    );
});

test('describes shared changes from structured activity details', () => {
    assert.equal(
        getActivityMessage({
            event_type: 'shared_change',
            details: { actor_name: 'Ana', operation: 'DELETE', table: 'letters', item_name: 'Para ti' }
        }),
        'Ana eliminó la carta «Para ti».'
    );
});

test('handles activity types without a shared-change message', () => {
    assert.equal(
        getActivityMessage({ event_type: 'capsule_revealed', details: {} }),
        'Una cápsula del tiempo ya está disponible.'
    );
});
