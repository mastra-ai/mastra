/**
 * Vitest resolves this file for `vi.mock('@workos-inc/node')`, which every test
 * file in this package registers without a factory. A factory cannot be used
 * here: `vi.mock` is hoisted above the test file's imports, so a factory could
 * not read the shared spies this mock exposes.
 *
 * The implementation lives in `src/` so the package's type-checking covers it;
 * see `src/_types/workos-sdk-mock.ts` for why the whole package shares one mock.
 */
export { GenerateLinkIntent, WorkOS, workosSdkMock } from '../../src/_types/workos-sdk-mock';
