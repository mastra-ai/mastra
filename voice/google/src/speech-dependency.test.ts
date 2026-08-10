import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for https://github.com/mastra-ai/mastra/issues/19206.
 *
 * `@google-cloud/speech` v6 depends on `google-gax` v4, which depends on `gaxios` v6.
 * On Node 22 and newer, that `gaxios` version aborts the Application Default Credentials
 * token exchange with ERR_STREAM_PREMATURE_CLOSE, so `GoogleVoice.listen()` always fails.
 * `@google-cloud/speech` v7 depends on `google-gax` v5, which uses `gaxios` v7 and works.
 *
 * The unit tests in `index.test.ts` replace `@google-cloud/speech` with `vi.mock`, so they
 * pass on the broken version as well. These assertions read package metadata from disk
 * instead, outside the mock boundary, and go red if the dependency moves back to v6.
 */
const require = createRequire(import.meta.url);

const MINIMUM_SPEECH_MAJOR = 7;
const MINIMUM_GAX_MAJOR = 5;

/** Returns the lowest major version that a caret or exact range accepts. */
function lowestMajor(range: string): number {
  const match = /^\^?(\d+)\./.exec(range.trim());
  if (!match) {
    throw new Error(`Unsupported version range: ${range}`);
  }
  return Number(match[1]);
}

describe('@google-cloud/speech dependency', () => {
  it('declares a range that excludes the broken v6 client', () => {
    const ownManifest = require('../package.json') as { dependencies: Record<string, string> };
    const range = ownManifest.dependencies['@google-cloud/speech'];

    expect(range).toBeDefined();
    expect(lowestMajor(range)).toBeGreaterThanOrEqual(MINIMUM_SPEECH_MAJOR);
  });

  it('resolves to a client that uses the fixed google-gax major', () => {
    const speechManifest = require('@google-cloud/speech/package.json') as {
      version: string;
      dependencies: Record<string, string>;
    };

    expect(lowestMajor(speechManifest.version)).toBeGreaterThanOrEqual(MINIMUM_SPEECH_MAJOR);
    expect(lowestMajor(speechManifest.dependencies['google-gax'])).toBeGreaterThanOrEqual(MINIMUM_GAX_MAJOR);
  });
});
