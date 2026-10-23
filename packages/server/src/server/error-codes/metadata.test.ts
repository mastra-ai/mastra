import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SERVER_ERROR_METADATA_SCHEMAS } from './metadata';
import { isServerErrorCode } from './index';

const CORE_SRC = join(__dirname, '../../../../core/src');

// Core ids that handlers rebuild with their metadata before forwarding (see ADD_ITEM_ROUTE and BATCH_INSERT_ITEMS_ROUTE).
const FORWARDED_WITH_METADATA = new Set(['DATASET_ITEM_IDENTITY_CONFLICT', 'DATASET_ITEM_EXTERNAL_ID_INVALID']);

function coreErrorIds(): Set<string> {
  const ids = new Set<string>();
  for (const entry of readdirSync(CORE_SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.ts$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) continue;
    const source = readFileSync(join(entry.parentPath, entry.name), 'utf8');
    for (const match of source.matchAll(/\bid:\s*['"]([A-Z][A-Z0-9_]+)['"]/g)) ids.add(match[1]!);
  }
  return ids;
}

describe('SERVER_ERROR_METADATA_SCHEMAS', () => {
  // Handlers forward a core error id as the business code, without the core error carrying the
  // metadata the code declares. Clients would then read fields the body doesn't have.
  it('keeps metadata optional for codes core can throw as an error id', () => {
    const forwarded = [...coreErrorIds()].filter(isServerErrorCode);
    expect(forwarded.length).toBeGreaterThan(0);

    const requiredButForwarded = forwarded.filter(code => {
      const schema = SERVER_ERROR_METADATA_SCHEMAS[code as keyof typeof SERVER_ERROR_METADATA_SCHEMAS];
      return schema && !schema.safeParse(undefined).success && !FORWARDED_WITH_METADATA.has(code);
    });

    expect(requiredButForwarded).toEqual([]);
  });
});
