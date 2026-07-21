import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the @mastra/playground-ui/components/* contract: component folders are
// published as their own entrypoints (wired up dynamically in vite.config.ts),
// including components nested below namespace-only folders. Every published
// component folder needs an index.ts or it silently disappears from dist.
const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));
const componentsDir = resolve(pkgRoot, 'src/ds/components');

const hasIndex = (directory: string) => existsSync(resolve(directory, 'index.ts'));

const findMissingComponentEntries = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== '__tests__')
    .flatMap(dirent => {
      const childDirectory = resolve(directory, dirent.name);
      if (hasIndex(childDirectory)) return [];

      const nestedDirectories = readdirSync(childDirectory, { withFileTypes: true }).filter(
        child => child.isDirectory() && child.name !== '__tests__',
      );

      if (nestedDirectories.length === 0) {
        return [relative(componentsDir, childDirectory).replace(/\\/g, '/')];
      }

      return findMissingComponentEntries(childDirectory);
    });

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

  it('has an index.ts entry in every component folder or nested namespace child', () => {
    const folders = readdirSync(componentsDir, { withFileTypes: true }).filter(d => d.isDirectory());
    expect(folders.length).toBeGreaterThan(0);
    expect(findMissingComponentEntries(componentsDir)).toEqual([]);
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

  it('Composer entry exports its compound components', async () => {
    const mod = await import('./ds/components/Composer');
    expect(mod.Composer).toBeDefined();
    expect(mod.ComposerAttachments).toBeDefined();
    expect(mod.ComposerInput).toBeDefined();
    expect(mod.ComposerActions).toBeDefined();
  });

  it('AI plan entry exports Plan', async () => {
    const mod = await import('./ds/components/ai/plan');
    expect(mod.Plan).toBeDefined();
  });

  it('AI ask-user entry exports AskUser', async () => {
    const mod = await import('./ds/components/ai/ask-user');
    expect(mod.AskUser).toBeDefined();
  });

  it('AI task-list entry exports TaskList', async () => {
    const mod = await import('./ds/components/ai/task-list');
    expect(mod.TaskList).toBeDefined();
  });
});
