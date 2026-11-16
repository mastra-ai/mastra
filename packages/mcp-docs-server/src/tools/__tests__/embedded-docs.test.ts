import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { embeddedDocsTools } from '../embedded-docs';

const tools = Object.values(embeddedDocsTools).map(tool => ({
  name: tool.name,
  projectPathSchema: tool.parameters.shape.projectPath,
}));

describe('embedded docs project path validation', () => {
  it.each(tools)('rejects an empty project path for $name', ({ projectPathSchema }) => {
    const result = projectPathSchema.safeParse('');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ message: 'Project path cannot be empty' })]),
      );
    }
  });

  it.each(tools)('rejects a relative project path for $name', ({ projectPathSchema }) => {
    const result = projectPathSchema.safeParse('.');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ message: 'Project path must be absolute' })]),
      );
    }
  });

  it.each(tools)('accepts an absolute project path for $name', ({ projectPathSchema }) => {
    expect(projectPathSchema.safeParse('/tmp/mastra-project').success).toBe(true);
  });
});

describe('embedded docs SOURCE_MAP.json', () => {
  let projectPath: string;

  beforeAll(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-source-map-'));

    const writePackage = async (name: string, sourceMapDir: string, exportName: string) => {
      const root = path.join(projectPath, 'node_modules', name);
      await fs.mkdir(path.join(root, sourceMapDir), { recursive: true });
      await fs.mkdir(path.join(root, 'dist/agent'), { recursive: true });
      await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name, version: '1.2.3' }));
      await fs.writeFile(path.join(root, 'dist/agent/agent.d.ts'), `export declare class ${exportName} {}\n`);
      await fs.writeFile(path.join(root, 'dist/agent-abc.js'), `var ${exportName} = class ${exportName} {};\n`);
      await fs.writeFile(
        path.join(root, sourceMapDir, 'SOURCE_MAP.json'),
        JSON.stringify({
          version: '1.2.3',
          package: name,
          exports: {
            [exportName]: { types: 'dist/agent/agent.d.ts', implementation: 'dist/agent-abc.js', line: 1 },
          },
          modules: {},
        }),
      );
    };

    await writePackage('@mastra/source-map-current', 'dist/docs/assets', 'Agent');
    await writePackage('@mastra/source-map-legacy', 'dist/docs', 'LegacyAgent');
  });

  afterAll(async () => {
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  it('reads the map from dist/docs/assets where packages generate it', async () => {
    const exportsOutput = await embeddedDocsTools.getMastraExports.execute({
      package: '@mastra/source-map-current',
      projectPath,
    });
    expect(exportsOutput).toContain('- **Agent**: `dist/agent-abc.js:1`');

    const details = await embeddedDocsTools.getMastraExportDetails.execute({
      package: '@mastra/source-map-current',
      exportName: 'Agent',
      projectPath,
      includeImplementation: true,
    });
    expect(details).toContain('export declare class Agent {}');
    expect(details).toContain('var Agent = class Agent {};');
  });

  it('still reads the map from dist/docs for older packages', async () => {
    const exportsOutput = await embeddedDocsTools.getMastraExports.execute({
      package: '@mastra/source-map-legacy',
      projectPath,
    });
    expect(exportsOutput).toContain('- **LegacyAgent**: `dist/agent-abc.js:1`');
  });
});
