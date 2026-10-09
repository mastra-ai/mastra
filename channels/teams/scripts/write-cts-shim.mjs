// Copy the ESM declaration to `dist/index.d.cts` byte-for-byte so the CJS
// `require` export condition can point at a `.d.cts` file resolved under CJS
// module semantics — instead of pointing at `./dist/index.d.ts`, which
// TypeScript interprets as ESM under a `"type": "module"` package and rejects
// with TS1479 when a `node16`/`nodenext` consumer imports it via `require`.
//
// A copy (rather than an `export * from './index'` re-export) sidesteps
// TS1479 at the shim itself: no cross-format import edge, just two files with
// identical declaration text resolved under their respective module systems.
// Sourcemaps aren't relevant to declaration files, so no companion `.d.cts.map`
// is emitted.
import { copyFile } from 'node:fs/promises';

await copyFile('dist/index.d.ts', 'dist/index.d.cts');
