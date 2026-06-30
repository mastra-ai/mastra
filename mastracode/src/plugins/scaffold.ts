import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { upsertPluginManifestEntry } from './manifest.js';
import { ensureMastraCodePackageLink } from './package-link.js';

export type ScaffoldPluginOptions = {
  id?: string;
  name?: string;
  projectRoot?: string;
  configDir?: string;
};

export function resolveScaffoldTarget(
  target: string,
  options: Pick<ScaffoldPluginOptions, 'projectRoot' | 'configDir'> = {},
): string {
  if (isBarePluginName(target)) {
    return path.join(
      options.projectRoot ?? process.cwd(),
      options.configDir ?? DEFAULT_CONFIG_DIR,
      'plugins',
      'sources',
      'local',
      target,
    );
  }
  return path.resolve(options.projectRoot ?? process.cwd(), target);
}

export function scaffoldPlugin(targetDir: string, options: ScaffoldPluginOptions = {}): string {
  const dir = resolveScaffoldTarget(targetDir, options);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    throw new Error(`Directory already exists and is not empty: ${targetDir}`);
  }

  const packageName =
    path
      .basename(dir)
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-|-$/g, '') || 'mastracode-plugin';
  const pluginId = options.id ?? packageName;
  const pluginName = options.name ?? humanizeName(packageName);

  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        type: 'module',
        exports: './src/index.ts',
        peerDependencies: {
          mastracode: '*',
        },
        devDependencies: {
          typescript: '^5.9.3',
        },
        scripts: {
          check: 'tsc --noEmit',
        },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2024',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          verbatimModuleSyntax: true,
          erasableSyntaxOnly: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(path.join(dir, 'src/index.ts'), renderIndex(pluginId, pluginName));
  fs.writeFileSync(path.join(dir, 'README.md'), renderReadme(pluginName, pluginId));
  writeScaffoldManifest(targetDir, dir, pluginId, pluginName, options);
  ensureMastraCodePackageLink(dir);
  return dir;
}

function writeScaffoldManifest(
  originalTarget: string,
  scaffoldDir: string,
  pluginId: string,
  pluginName: string,
  options: ScaffoldPluginOptions,
): void {
  const projectRoot = options.projectRoot ?? process.cwd();
  const manifestRoot = isBarePluginName(originalTarget) ? projectRoot : scaffoldDir;
  const entry = isBarePluginName(originalTarget)
    ? path.join(path.relative(projectRoot, scaffoldDir), 'src/index.ts')
    : 'src/index.ts';
  upsertPluginManifestEntry(manifestRoot, {
    id: pluginId,
    name: pluginName,
    entry: entry.split(path.sep).join('/'),
  });
}

export function formatScaffoldSuccess(targetDir: string): string {
  return [
    `Created Mastra Code plugin scaffold at ${targetDir}`,
    '',
    'Next steps:',
    `  cd ${targetDir}`,
    '  pnpm install',
    '  pnpm check',
    '  mastracode',
    '  /plugins',
    '  Install new plugin → Local path',
  ].join('\n');
}

function isBarePluginName(target: string): boolean {
  return !path.isAbsolute(target) && !target.startsWith('.') && !target.includes('/') && !target.includes('\\');
}

function renderIndex(pluginId: string, pluginName: string): string {
  return `import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';

export default defineMastraCodePlugin({
  id: ${JSON.stringify(pluginId)},
  name: ${JSON.stringify(pluginName)},
  description: 'A Mastra Code tool plugin.',
  tools: {
    example_tool: {
      tool: createTool({
        id: 'example_tool',
        description: 'Echo a message from the scaffolded plugin.',
        inputSchema: z.object({
          message: z.string(),
        }),
        execute: async context => {
          return { message: context.message };
        },
      }),
    },
  },
});
`;
}

function renderReadme(pluginName: string, pluginId: string): string {
  return `# ${pluginName}

Mastra Code tool plugin: \`${pluginId}\`.

## Develop

\`\`\`sh
pnpm install
pnpm check
\`\`\`

## Install locally

Open Mastra Code, run \`/plugins\`, and install this directory as a local plugin.
`;
}

function humanizeName(value: string): string {
  return (
    value
      .split(/[-_.]+/g)
      .filter(Boolean)
      .map(part => part[0]?.toUpperCase() + part.slice(1))
      .join(' ') || 'Mastra Code Plugin'
  );
}
