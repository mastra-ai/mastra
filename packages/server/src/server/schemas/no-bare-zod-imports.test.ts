import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Server schemas compose helpers built with `zod/v4` (e.g. `common.ts`). A module
 * importing bare `'zod'` produces v3 schemas when the application resolves `zod`
 * to v3, and mixing v3 and v4 schemas in one object breaks parsing and JSON
 * schema conversion. Every schema module must import `zod/v4` explicitly.
 */
describe('server schema modules', () => {
  it('do not import bare zod', () => {
    const schemasDir = path.dirname(fileURLToPath(import.meta.url));
    const bareZodImport = /from\s+['"]zod['"]/;

    const offenders = fs
      .readdirSync(schemasDir)
      .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .filter(file => bareZodImport.test(fs.readFileSync(path.join(schemasDir, file), 'utf8')));

    expect(offenders).toEqual([]);
  });
});
