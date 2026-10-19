import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyzeBundle } from '../analyze';
import { getInputOptions } from '../bundler';
import type { ToolUIRegistry } from '../plugins/extract-tool-ui';

const tempRoot = join(import.meta.dirname, '..', '..', '..', '.tmp');

async function createProject() {
  await mkdir(tempRoot, { recursive: true });
  const dir = await mkdtemp(join(tempRoot, 'mastra-tool-ui-'));
  await mkdir(join(dir, '.mastra', '.build'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
  await writeFile(
    join(dir, 'weather-card.tsx'),
    `import { useState } from 'react';\nexport function WeatherCard() { const [x] = useState('WEATHER_CARD_SOURCE'); return <div>{x}</div>; }\n`,
  );
  await writeFile(
    join(dir, 'tool.ts'),
    `import { WeatherCard } from './weather-card';\nexport const weatherTool = { id: 'weather', ui: { studioComponent: WeatherCard } };\n`,
  );
  await writeFile(join(dir, 'index.ts'), `export { weatherTool } from './tool';\n`);
  return dir;
}

describe('server bundle with ui.studioComponent', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await createProject();
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('does not report react as a server dependency during analysis', async () => {
    const entryFile = join(projectDir, 'index.ts');
    const originalCwd = process.cwd();
    process.chdir(projectDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir: join(projectDir, '.mastra', '.build'),
          projectRoot: projectDir,
          platform: 'node',
          bundlerOptions: { externals: [], enableSourcemap: false },
        },
        noopLogger,
      );

      expect([...result.dependencies.keys(), ...result.externalDependencies.keys()]).not.toContain('react');
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);

  it('replaces the component with its id and keeps the component out of the output', async () => {
    const entryFile = join(projectDir, 'index.ts');
    const registry: ToolUIRegistry = new Map();
    const inputOptions = await getInputOptions(
      entryFile,
      { dependencies: new Map(), externalDependencies: new Map(), workspaceMap: new Map() },
      'node',
      undefined,
      { projectRoot: projectDir, toolUIRegistry: registry },
    );

    const bundle = await rollup({ ...inputOptions, input: entryFile, logLevel: 'silent' });
    const { output } = await bundle.generate({ format: 'esm' });
    await bundle.close();
    const code = output.map(chunk => (chunk.type === 'chunk' ? chunk.code : '')).join('\n');

    const [component] = [...registry.values()];
    expect(registry.size).toBe(1);
    expect(component).toMatchObject({
      importer: join(projectDir, 'tool.ts'),
      source: './weather-card',
      exportName: 'WeatherCard',
    });
    expect(code).toContain(`studioComponent: "${component!.id}"`);
    expect(code).not.toContain('WEATHER_CARD_SOURCE');
    expect(code).not.toContain('react');
  });
});
