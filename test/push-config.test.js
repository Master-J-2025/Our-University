import test from 'node:test';
import assert from 'node:assert/strict';
import {
    assertPushConfiguration,
    getMissingPushSecrets,
    MissingPushConfigError,
    requiredPushSecrets
} from '../supabase/functions/_shared/push-config.js';

test('reports the exact missing push configuration without exposing values', () => {
    const secrets = new Map([
        ['VAPID_PUBLIC_KEY', 'public-value'],
        ['APP_URL', 'https://example.test/']
    ]);

    assert.deepEqual(
        getMissingPushSecrets(name => secrets.get(name)),
        ['VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']
    );
});

test('accepts a complete push configuration', () => {
    const secrets = new Map(requiredPushSecrets.map(name => [name, `configured-${name}`]));
    assert.doesNotThrow(() => assertPushConfiguration(name => secrets.get(name)));
});

test('fails explicitly when a required push secret is blank', () => {
    const secrets = new Map(requiredPushSecrets.map(name => [name, `configured-${name}`]));
    secrets.set('VAPID_SUBJECT', '  ');
    assert.throws(
        () => assertPushConfiguration(name => secrets.get(name)),
        error => error instanceof MissingPushConfigError
            && error.message.includes('VAPID_SUBJECT')
            && !error.message.includes('configured-')
    );
});
