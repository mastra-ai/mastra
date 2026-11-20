import { createHash } from 'node:crypto';

import { initialSchemaStatements } from './0001-initial-schema.js';
import { stagingPrivilegeIntentStatements } from './0002-staging-privilege-intents.js';
import { deviceTrustStatements } from './0003-device-trust.js';
import { workosExpectedCallbackStatements } from './0004-workos-expected-callbacks.js';
import { analyticsJournalStatements } from './0005-analytics-journal.js';

export type Migration = Readonly<{
  version: number;
  name: string;
  checksum: string;
  statements: readonly string[];
}>;

export function migrationChecksum(statements: readonly string[]): string {
  return createHash('sha256').update(statements.join('\n')).digest('hex');
}

function defineMigration(version: number, name: string, statements: readonly string[]): Migration {
  return Object.freeze({
    version,
    name,
    statements,
    checksum: migrationChecksum(statements),
  });
}

/**
 * The first public release starts from the complete operational schema.
 * Append future changes here as immutable, sequential migrations.
 */
export const migrations = Object.freeze([
  defineMigration(1, 'initial-schema', initialSchemaStatements),
  defineMigration(2, 'staging-privilege-intents', stagingPrivilegeIntentStatements),
  defineMigration(3, 'first-party-device-trust', deviceTrustStatements),
  defineMigration(4, 'workos-expected-membership-callbacks', workosExpectedCallbackStatements),
  defineMigration(5, 'analytics-journal', analyticsJournalStatements),
]);
