import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BROWSER_FETCHABLE_SCHEMES,
  NON_FETCHABLE_REMOTE_SCHEMES,
  REMOTE_URL_SCHEMES,
  isBrowserFetchableUrl,
  isNonFetchableRemoteUrl,
  isRemoteUrl,
} from '../schemes';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Core is the source of truth for which URL protocols an attachment may use:
 * `packages/core/src/agent/message-list/prompt/attachments-to-parts.ts` has a
 * `switch (url.protocol)` that whitelists the supported schemes and throws
 * `Unsupported URL protocol` for anything else. If the UI accepts a scheme core
 * rejects (or vice versa), users hit runtime errors. This test pins the two
 * lists together so a change to core's switch forces a matching UI change.
 */
const CORE_ATTACHMENTS_TO_PARTS = resolve(
  here,
  '../../../../../core/src/agent/message-list/prompt/attachments-to-parts.ts',
);

/** Extracts protocols (without the trailing colon) from core's `case 'x:':` lines. */
const readCoreSupportedProtocols = (): string[] => {
  const source = readFileSync(CORE_ATTACHMENTS_TO_PARTS, 'utf8');
  const switchStart = source.indexOf('switch (url.protocol)');
  expect(switchStart, 'could not locate the protocol switch in core').toBeGreaterThan(-1);

  // Only scan the protocol switch block, and stop before the `data:`/`default`
  // cases which are handled separately from remote-URL schemes.
  const block = source.slice(switchStart);
  const dataCaseIndex = block.indexOf("case 'data:'");
  const scanRegion = dataCaseIndex > -1 ? block.slice(0, dataCaseIndex) : block;

  const protocols = new Set<string>();
  for (const match of scanRegion.matchAll(/case '([a-z0-9]+):'/g)) {
    const protocol = match[1];
    assert(protocol !== undefined, 'Expected a protocol capture group in the core switch case');
    protocols.add(protocol);
  }
  return [...protocols].sort();
};

/** Maps the UI scheme strings (e.g. `https://`) to bare protocols (e.g. `https`). */
const toProtocols = (schemes: readonly string[]): string[] =>
  [...new Set(schemes.map(scheme => scheme.replace(/:\/\/$/, '')))].sort();

describe('attachment URL schemes', () => {
  it('matches the protocols core accepts in attachments-to-parts.ts', () => {
    const coreProtocols = readCoreSupportedProtocols();
    expect(coreProtocols).toEqual(['gs', 'http', 'https', 's3']);
    expect(toProtocols(REMOTE_URL_SCHEMES)).toEqual(coreProtocols);
  });

  it('partitions remote schemes into fetchable and non-fetchable', () => {
    expect([...BROWSER_FETCHABLE_SCHEMES]).toEqual(['https://', 'http://']);
    expect([...NON_FETCHABLE_REMOTE_SCHEMES]).toEqual(['gs://', 's3://']);
    expect([...REMOTE_URL_SCHEMES].sort()).toEqual(
      [...BROWSER_FETCHABLE_SCHEMES, ...NON_FETCHABLE_REMOTE_SCHEMES].sort(),
    );
  });

  it('classifies URLs with the shared predicates', () => {
    expect(isRemoteUrl('https://example.com/a.png')).toBe(true);
    expect(isRemoteUrl('gs://bucket/a.mp4')).toBe(true);
    expect(isRemoteUrl('s3://bucket/a.pdf')).toBe(true);
    expect(isRemoteUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isRemoteUrl('relative/path.png')).toBe(false);

    expect(isBrowserFetchableUrl('http://x/a')).toBe(true);
    expect(isBrowserFetchableUrl('https://x/a')).toBe(true);
    expect(isBrowserFetchableUrl('gs://x/a')).toBe(false);

    expect(isNonFetchableRemoteUrl('gs://x/a')).toBe(true);
    expect(isNonFetchableRemoteUrl('s3://x/a')).toBe(true);
    expect(isNonFetchableRemoteUrl('https://x/a')).toBe(false);
  });
});
