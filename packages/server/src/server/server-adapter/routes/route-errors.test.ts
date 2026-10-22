import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeRouteErrors, missingErrorCodes } from '../../../../scripts/route-error-analysis';
import { isServerErrorCode } from '../../error-codes';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('route error declarations', () => {
  const routes = analyzeRouteErrors(serverRoot);

  it('finds the built-in routes', () => {
    expect(routes.length).toBeGreaterThan(400);
  });

  it('declares every business code each handler can reach (run `pnpm check:route-errors --write` to fix)', () => {
    const missing = routes
      .map(route => ({ route: `${route.name} (${route.file}:${route.line})`, codes: missingErrorCodes(route) }))
      .filter(entry => entry.codes.length > 0);

    expect(missing).toEqual([]);
  });

  it('only declares codes from the server catalog', () => {
    const unknown = routes.flatMap(route => (route.declared ?? []).filter(code => !isServerErrorCode(code)));
    expect(unknown).toEqual([]);
  });
});
