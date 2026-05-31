import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const srcRoot = join(__dirname, '..');

function findTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__fixtures__' || entry.name === 'node_modules') return [];
      return findTypeScriptFiles(path);
    }
    if (!entry.name.endsWith('.ts')) return [];
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test-d.ts')) return [];
    return [path];
  });
}

describe('@mastra/server runtime imports of @mastra/core/agent-builder/ee', () => {
  // Regression: any non-type, non-dynamic import of `@mastra/core/agent-builder/ee`
  // from server runtime code becomes a top-level static import in the bundled
  // deploy output. The subpath only ships in @mastra/core >= 1.34.0, so a static
  // import crashes server startup (ERR_MODULE_NOT_FOUND / ERR_PACKAGE_PATH_NOT_EXPORTED)
  // for any user whose installed @mastra/core does not include it.
  //
  // All runtime references to the EE subpath MUST be either:
  //   1. `import type { ... } from '@mastra/core/agent-builder/ee'` (erased at build), or
  //   2. `await import('@mastra/core/agent-builder/ee')` inside a branch that is only
  //       reached when an `IMastraEditor` with builder support is configured.
  //
  // If you need to add a value import from this subpath, gate it with a dynamic
  // import behind a runtime check that ensures a compatible core is installed.
  it('contains no static value imports from @mastra/core/agent-builder/ee', () => {
    const offenders: { file: string; line: string }[] = [];
    const staticImportPattern = /^\s*import\s+(?!type\b)[^;]*from\s+['"]@mastra\/core\/agent-builder\/ee['"]/;

    for (const file of findTypeScriptFiles(srcRoot)) {
      const src = readFileSync(file, 'utf8');
      for (const line of src.split('\n')) {
        if (staticImportPattern.test(line)) {
          offenders.push({ file: file.replace(srcRoot, '<src>'), line: line.trim() });
        }
      }
    }

    expect(
      offenders,
      `Found static value imports from @mastra/core/agent-builder/ee that will crash deploys on @mastra/core < 1.34.0:\n${offenders.map(o => `  ${o.file}: ${o.line}`).join('\n')}`,
    ).toEqual([]);
  });
});
