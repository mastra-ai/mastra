import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeEntryProjectType, checkMastraConfigExport } from './analyzeEntryProjectType';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function createProject(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-config-export-'));
  tempDirs.push(dir);
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(dir, name), content)));
  return dir;
}

describe('checkMastraConfigExport', () => {
  it('parses a TypeScript entry and finds the exported Mastra instance', async () => {
    const dir = await createProject({
      'index.ts': `import { Mastra } from '@mastra/core/mastra';
type Options = { name: string };
const options: Options = { name: 'x' };
export const mastra = new Mastra({} satisfies Record<string, unknown>);
`,
    });

    await expect(checkMastraConfigExport(join(dir, 'index.ts'))).resolves.toEqual({ hasValidConfig: true });
  });

  it("ignores the project's own Babel config", async () => {
    // Loading this config would throw because the preset isn't installed.
    const dir = await createProject({
      'babel.config.json': JSON.stringify({ presets: ['babel-preset-that-does-not-exist'] }),
      '.babelrc': JSON.stringify({ presets: ['another-missing-preset'] }),
      'index.ts': `import { Mastra } from '@mastra/core/mastra';\nexport const mastra = new Mastra({});\n`,
    });

    await expect(checkMastraConfigExport(join(dir, 'index.ts'))).resolves.toEqual({ hasValidConfig: true });
    await expect(analyzeEntryProjectType(join(dir, 'index.ts'))).resolves.toBeUndefined();
  });
});
