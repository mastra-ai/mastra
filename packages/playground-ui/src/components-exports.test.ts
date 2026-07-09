import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the @mastra/playground-ui/components/* contract: every folder under
// src/ds/components is published as its own entrypoint (wired up dynamically
// in vite.config.ts), so consumers can deep-import a single component without
// a root package entry. The entry enumeration assumes one index.ts per folder —
// if that invariant breaks, the component silently disappears from dist.
const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));
const componentsDir = resolve(pkgRoot, 'src/ds/components');
const componentNamespaceDirs = new Set(['ai']);

describe('components/* subpath exports', () => {
  it('exposes the wildcard export pointing into dist/components', () => {
    expect(pkg.exports['./components/*']).toEqual({
      import: {
        types: './dist/components/*.d.ts',
        default: './dist/components/*.es.js',
      },
    });
  });

  it('marks only CSS as side-effectful so bundlers can tree-shake JS', () => {
    expect(pkg.sideEffects).toEqual(['**/*.css']);
  });

  it('has an index.ts in every component folder outside namespace folders', () => {
    const folders = readdirSync(componentsDir, { withFileTypes: true }).filter(
      d => d.isDirectory() && !componentNamespaceDirs.has(d.name),
    );
    expect(folders.length).toBeGreaterThan(0);
    const missing = folders.filter(d => !existsSync(resolve(componentsDir, d.name, 'index.ts'))).map(d => d.name);
    expect(missing).toEqual([]);
  });

  // Representative entry modules: a plain primitive, a component with its own
  // scoped CSS, and a composite. Importing the source entries guards that each
  // index.ts actually exports the public symbol the subpath promises.
  it('Button entry exports Button', async () => {
    const mod = await import('./ds/components/Button');
    expect(mod.Button).toBeDefined();
  });

  it('Drawer entry (scoped CSS) exports Drawer', async () => {
    const mod = await import('./ds/components/Drawer');
    expect(mod.Drawer).toBeDefined();
  });

  it('DataPanel entry exports DataPanel', async () => {
    const mod = await import('./ds/components/DataPanel');
    expect(mod.DataPanel).toBeDefined();
  });

  it('AI plan entry exports Plan', async () => {
    const mod = await import('./ds/components/ai/plan');
    expect(mod.Plan).toBeDefined();
  });
});
