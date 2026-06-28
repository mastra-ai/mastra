import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scaffoldPlugin } from '../../src/plugins/scaffold.js';
import type { McE2ePrepareContext, McE2eScenario } from './types.js';

const MASTRACODE_PACKAGE_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const PLUGIN_ID = 'e2e.local-plugin';
const PLUGIN_NAME = 'E2E Local Plugin';
const TOOL_NAME = 'e2e_plugin_lookup';
const PROMPT = 'Use the local plugin tool availability check.';
const RESPONSE = 'Plugin tool availability verified.';

let currentTui: unknown;
let hotReloadPluginDir: string | undefined;

function writeLocalPlugin({ projectDir }: Pick<McE2ePrepareContext, 'projectDir'>): string {
  const pluginDir = join(projectDir, 'fixtures', 'plugins', 'local-plugin');
  const pluginSrcDir = join(pluginDir, 'src');
  mkdirSync(pluginSrcDir, { recursive: true });
  writePluginPackageLink(pluginDir);

  writeFileSync(
    join(pluginSrcDir, 'index.ts'),
    `import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';

export default defineMastraCodePlugin({
  id: '${PLUGIN_ID}',
  name: '${PLUGIN_NAME}',
  description: 'Plugin used by Mastra Code E2E tests.',
  tools: {
    ${TOOL_NAME}: createTool({
      id: '${TOOL_NAME}',
      description: 'Return an E2E plugin lookup result.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ context }) => ({ query: context.query, source: '${PLUGIN_ID}' }),
    }),
  },
});
`,
  );

  return pluginDir;
}

function writeStreamingPlugin({ projectDir }: Pick<McE2ePrepareContext, 'projectDir'>): string {
  const pluginDir = join(projectDir, 'fixtures', 'plugins', 'streaming-plugin');
  const pluginSrcDir = join(pluginDir, 'src');
  mkdirSync(pluginSrcDir, { recursive: true });
  writePluginPackageLink(pluginDir);

  writeFileSync(
    join(pluginSrcDir, 'index.ts'),
    `import { createTool, defineMastraCodePlugin, writeToolProgress, z } from 'mastracode/plugin';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export default defineMastraCodePlugin({
  id: '${PLUGIN_ID}',
  name: '${PLUGIN_NAME}',
  description: 'Plugin used by Mastra Code E2E tests.',
  tools: {
    ${TOOL_NAME}: Object.assign(createTool({
      id: '${TOOL_NAME}',
      description: 'Stream progress before returning an E2E plugin lookup result.',
      inputSchema: z.object({ query: z.string() }),
      execute: async (input, toolContext) => {
        await writeToolProgress(toolContext, { event: 'text', text: 'E2E plugin progress visible before completion' });
        await sleep(1500);
        return { query: input.query, source: '${PLUGIN_ID}', done: true };
      },
    }), {
      mastracode: {
        render: { type: 'subagent', agentType: 'e2e-plugin' },
      },
    }),
  },
});
`,
  );

  return pluginDir;
}

function writeHotReloadPlugin({ projectDir }: Pick<McE2ePrepareContext, 'projectDir'>, result: string): string {
  const pluginDir = join(projectDir, 'fixtures', 'plugins', 'hot-reload-plugin');
  const pluginSrcDir = join(pluginDir, 'src');
  mkdirSync(pluginSrcDir, { recursive: true });
  writePluginPackageLink(pluginDir);

  writeFileSync(
    join(pluginSrcDir, 'index.ts'),
    `import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';

export default defineMastraCodePlugin({
  id: '${PLUGIN_ID}',
  name: '${PLUGIN_NAME}',
  description: 'Plugin used by Mastra Code E2E hot reload tests.',
  tools: {
    ${TOOL_NAME}: createTool({
      id: '${TOOL_NAME}',
      description: 'Return the current hot reload plugin result.',
      inputSchema: z.object({ query: z.string() }),
      execute: async input => ({ query: input.query, result: '${result}' }),
    }),
  },
});
`,
  );

  return pluginDir;
}

function writePluginPackageLink(pluginDir: string): void {
  const nodeModulesDir = join(pluginDir, 'node_modules');
  mkdirSync(nodeModulesDir, { recursive: true });
  try {
    symlinkSync(MASTRACODE_PACKAGE_DIR, join(nodeModulesDir, 'mastracode'), 'dir');
  } catch {
    // The link may already exist if a scenario reuses the same prepared directory.
  }
}

function writePluginRegistry(projectDir: string, pluginDir: string, enabled = true): void {
  const registryDir = join(projectDir, '.mastracode', 'plugins');
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(
    join(registryDir, 'plugins.json'),
    JSON.stringify(
      {
        plugins: {
          [PLUGIN_ID]: {
            enabled,
            source: 'local',
            specifier: pluginDir,
            path: pluginDir,
            entry: 'src/index.ts',
          },
        },
      },
      null,
      2,
    ),
  );
}

function getToolNames(requests: unknown[]): string[] {
  const names = new Set<string>();
  for (const request of requests as Array<{ body?: { tools?: unknown[] } }>) {
    for (const tool of request.body?.tools ?? []) {
      const name =
        (tool as { function?: { name?: unknown }; name?: unknown }).function?.name ?? (tool as { name?: unknown }).name;
      if (typeof name === 'string') names.add(name);
    }
  }
  return [...names].sort();
}

export const pluginsLocalToolScenario: McE2eScenario = {
  name: 'plugins-local-tool',
  description: 'Loads a project-local TypeScript plugin and advertises its Mastra tool to the model request.',
  testName: 'advertises local plugin tools to model requests',
  useOpenAIModel: true,
  aimockFixture: 'plugins-local-tool.json',
  prepare({ projectDir }) {
    const pluginDir = writeLocalPlugin({ projectDir });
    writePluginRegistry(projectDir, pluginDir);
  },
  async inProcessApp({ homeDir, projectDir, startMastraCodeApp }) {
    const { PluginManager } = await import('../../src/plugins/manager.js');
    return startMastraCodeApp({
      config: {
        pluginManager: new PluginManager({ projectRoot: projectDir, configDir: '.mastracode', homeDir }),
      },
      onTuiCreated: tui => {
        currentTui = tui;
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit(PROMPT);
    await runtime.waitForScreenText(new RegExp(RESPONSE), terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const names = getToolNames(requests);
    if (!names.includes(TOOL_NAME)) {
      throw new Error(`Expected provider request to expose plugin tool ${TOOL_NAME}. Names: ${names.join(', ')}`);
    }
  },
};

export const pluginsStreamingToolOutputScenario: McE2eScenario = {
  name: 'plugins-streaming-tool-output',
  description: 'Streams progress from an installed plugin tool into the TUI before the tool completes.',
  testName: 'streams installed plugin tool progress before final result',
  useOpenAIModel: true,
  aimockFixture: 'plugins-streaming-tool-output.json',
  prepare({ projectDir }) {
    const pluginDir = writeStreamingPlugin({ projectDir });
    writePluginRegistry(projectDir, pluginDir);
  },
  async inProcessApp({ homeDir, projectDir, startMastraCodeApp }) {
    const { PluginManager } = await import('../../src/plugins/manager.js');
    return startMastraCodeApp({
      config: {
        pluginManager: new PluginManager({ projectRoot: projectDir, configDir: '.mastracode', homeDir }),
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('Use the streaming plugin tool.');
    await runtime.waitForScreenText(/E2E plugin progress visible before completion/i, terminal, 10_000);
    await runtime.waitForScreenText(/Streaming plugin tool completed/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const names = getToolNames(requests);
    if (!names.includes(TOOL_NAME)) {
      throw new Error(
        `Expected provider request to expose streaming plugin tool ${TOOL_NAME}. Names: ${names.join(', ')}`,
      );
    }
  },
};

export const pluginsScaffoldInstallToolScenario: McE2eScenario = {
  name: 'plugins-scaffold-install-tool',
  description: 'Scaffolds a plugin, installs it through /plugins, and executes its example tool.',
  testName: 'scaffolds installs and executes a plugin tool through the TUI',
  useOpenAIModel: true,
  aimockFixture: 'plugins-scaffold-install-tool.json',
  prepare({ projectDir }) {
    scaffoldPlugin('scaffolded-e2e-plugin', {
      projectRoot: projectDir,
      id: 'e2e.scaffolded-plugin',
      name: 'E2E Scaffolded Plugin',
    });
  },
  async inProcessApp({ homeDir, projectDir, startMastraCodeApp }) {
    const { PluginManager } = await import('../../src/plugins/manager.js');
    return startMastraCodeApp({
      config: {
        pluginManager: new PluginManager({ projectRoot: projectDir, configDir: '.mastracode', homeDir }),
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('/plugins');
    await runtime.waitForScreenText(/Install new plugin/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Install plugin from:/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Local plugin path or discovered plugin:/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Install scope:/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Plugins run code inside Mastra Code/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/E2E Scaffolded Plugin/i, terminal, 8_000);
    await runtime.waitForScreenText(/active/i, terminal, 8_000);
    terminal.write('\x1b');

    terminal.submit('Use the scaffolded example plugin tool.');
    await runtime.waitForScreenText(/Scaffolded example tool returned hello from scaffold/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const names = getToolNames(requests);
    if (!names.includes('example_tool')) {
      throw new Error(`Expected provider request to expose scaffolded example_tool. Names: ${names.join(', ')}`);
    }
  },
};

export const pluginsLocalHotReloadScenario: McE2eScenario = {
  name: 'plugins-local-hot-reload',
  description: 'Reloads an installed local plugin after source edits without restarting Mastra Code.',
  testName: 'hot reloads a local plugin in the same TUI session',
  useOpenAIModel: true,
  aimockFixture: 'plugins-local-hot-reload.json',
  prepare({ projectDir }) {
    hotReloadPluginDir = writeHotReloadPlugin({ projectDir }, 'version-one');
    writePluginRegistry(projectDir, hotReloadPluginDir);
  },
  async inProcessApp({ homeDir, projectDir, startMastraCodeApp }) {
    const { PluginManager } = await import('../../src/plugins/manager.js');
    return startMastraCodeApp({
      config: {
        pluginManager: new PluginManager({ projectRoot: projectDir, configDir: '.mastracode', homeDir }),
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('Call the hot reload plugin before edit.');
    await runtime.waitForScreenText(/version-one/i, terminal, 10_000);

    if (!hotReloadPluginDir) throw new Error('Hot reload plugin directory was not prepared');
    writeHotReloadPlugin({ projectDir: dirname(dirname(dirname(hotReloadPluginDir))) }, 'version-two');
    await runtime.sleep(900);

    terminal.submit('Call the hot reload plugin after edit.');
    await runtime.waitForScreenText(/version-two/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const names = getToolNames(requests);
    if (!names.includes(TOOL_NAME)) {
      throw new Error(
        `Expected provider request to expose hot reload plugin tool ${TOOL_NAME}. Names: ${names.join(', ')}`,
      );
    }
    const requestText = JSON.stringify(requests);
    if (!requestText.includes('version-one') || !requestText.includes('version-two')) {
      throw new Error('Expected provider follow-up requests to include both hot reload tool results.');
    }
  },
};

export const pluginsCommandUiScenario: McE2eScenario = {
  name: 'plugins-command-ui',
  description: 'Shows installed plugins and plugin details in the /plugins TUI command.',
  testName: 'renders plugin list and detail screens',
  prepare({ projectDir }) {
    const pluginDir = writeLocalPlugin({ projectDir });
    writePluginRegistry(projectDir, pluginDir);
  },
  async inProcessApp({ homeDir, projectDir, startMastraCodeApp }) {
    const { PluginManager } = await import('../../src/plugins/manager.js');
    return startMastraCodeApp({
      config: {
        pluginManager: new PluginManager({ projectRoot: projectDir, configDir: '.mastracode', homeDir }),
      },
      onTuiCreated: tui => {
        currentTui = tui;
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('/plugins');
    await runtime.waitForScreenText(/Install new plugin/i, terminal, 8_000);
    await runtime.waitForScreenText(new RegExp(PLUGIN_NAME), terminal, 8_000);
    await runtime.waitForScreenText(new RegExp(PLUGIN_ID), terminal, 8_000);
    await runtime.waitForScreenText(/project/i, terminal, 8_000);
    await runtime.waitForScreenText(/active/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Install plugin from:/i, terminal, 8_000);
    await runtime.waitForScreenText(/Local path/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.sleep(100);

    (
      currentTui as { state?: { ui?: { hideOverlay?: () => void; requestRender?: () => void } } } | undefined
    )?.state?.ui?.hideOverlay?.();
    (currentTui as { state?: { ui?: { requestRender?: () => void } } } | undefined)?.state?.ui?.requestRender?.();
    await runtime.sleep(100);
    terminal.submit(`/plugins ${PLUGIN_ID}`);
    await runtime.waitForScreenText(new RegExp(`tools:.*${TOOL_NAME}`), terminal, 8_000);
    await runtime.waitForScreenText(/Deactivate/i, terminal, 8_000);
    await runtime.waitForScreenText(/Uninstall/i, terminal, 8_000);

    terminal.write('\x1b');
    terminal.keyCtrlC();
  },
};
