import { execFileSync } from 'node:child_process';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scaffoldPlugin } from '../../src/plugins/scaffold.js';
import type { McE2ePrepareContext, McE2eScenario } from './types.js';
import { typeTextSlowly } from './typing-utils.js';

const MASTRACODE_PACKAGE_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const PLUGIN_ID = 'e2e.local-plugin';
const PLUGIN_NAME = 'E2E Local Plugin';
const TOOL_NAME = 'e2e_plugin_lookup';
const PROMPT = 'Use the local plugin tool availability check.';
const RESPONSE = 'Plugin tool availability verified.';

let currentTui: unknown;
let hotReloadPluginDir: string | undefined;
let githubPollSourceDir: string | undefined;
let githubPollManager: { pollGithubSourcesForUpdates: () => Promise<boolean> } | undefined;

function resetPluginScenarioState(): void {
  currentTui = undefined;
  hotReloadPluginDir = undefined;
  githubPollSourceDir = undefined;
  githubPollManager = undefined;
}

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
    ${TOOL_NAME}: {
      tool: createTool({
        id: '${TOOL_NAME}',
        description: 'Return an E2E plugin lookup result.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ context }) => ({ query: context.query, source: '${PLUGIN_ID}' }),
      }),
    },
  },
});
`,
  );

  return pluginDir;
}

function writeAssetPlugin({ projectDir }: Pick<McE2ePrepareContext, 'projectDir'>): string {
  const pluginDir = join(projectDir, 'fixtures', 'plugins', 'asset-plugin');
  const pluginSrcDir = join(pluginDir, 'src');
  const commandsDir = join(pluginDir, 'commands');
  const skillDir = join(pluginDir, 'skills', 'e2e-plugin-asset-skill');
  mkdirSync(pluginSrcDir, { recursive: true });
  mkdirSync(commandsDir, { recursive: true });
  mkdirSync(skillDir, { recursive: true });
  writePluginPackageLink(pluginDir);

  writeFileSync(
    join(pluginSrcDir, 'index.ts'),
    `import { defineMastraCodePlugin } from 'mastracode/plugin';

export default defineMastraCodePlugin({
  id: '${PLUGIN_ID}',
  name: '${PLUGIN_NAME}',
  description: 'Plugin used by Mastra Code E2E asset loading tests.',
  tools: {},
});
`,
  );
  writeFileSync(
    join(commandsDir, 'e2e-plugin-assets.md'),
    `---\ndescription: E2E plugin bundled command autocomplete description\n---\nE2E plugin bundled command executed.\n\nARGUMENTS: $ARGUMENTS\n`,
  );
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: e2e-plugin-asset-skill\ndescription: E2E plugin bundled skill autocomplete description\nuser-invocable: true\n---\nE2E plugin bundled skill instructions.\n`,
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
    ${TOOL_NAME}: {
      tool: createTool({
        id: '${TOOL_NAME}',
        description: 'Stream progress before returning an E2E plugin lookup result.',
        inputSchema: z.object({ query: z.string() }),
        execute: async (input, toolContext) => {
          await writeToolProgress(toolContext, { event: 'text', text: 'E2E plugin progress visible before completion' });
          await sleep(1500);
          return { query: input.query, source: '${PLUGIN_ID}', done: true };
        },
      }),
      render: { type: 'subagent', agentType: 'e2e-plugin' },
    },
  },
});
`,
  );

  return pluginDir;
}

function writeHotReloadPlugin({ projectDir }: Pick<McE2ePrepareContext, 'projectDir'>, result: string): string {
  const pluginDir = join(projectDir, 'fixtures', 'plugins', 'hot-reload-plugin');
  writeHotReloadPluginSource(pluginDir, result);
  return pluginDir;
}

function writeHotReloadPluginSource(pluginDir: string, result: string): void {
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
    ${TOOL_NAME}: {
      tool: createTool({
        id: '${TOOL_NAME}',
        description: 'Return the current hot reload plugin result.',
        inputSchema: z.object({ query: z.string() }),
        execute: async input => ({ query: input.query, result: '${result}' }),
      }),
    },
  },
});
`,
  );
}

function writePluginPackageLink(pluginDir: string): void {
  const nodeModulesDir = join(pluginDir, 'node_modules');
  mkdirSync(nodeModulesDir, { recursive: true });
  try {
    symlinkSync(MASTRACODE_PACKAGE_DIR, join(nodeModulesDir, 'mastracode'), 'dir');
  } catch (error) {
    if (!error || typeof error !== 'object' || (error as { code?: string }).code !== 'EEXIST') {
      throw error;
    }
  }
}

function writePluginRegistry(
  projectDir: string,
  pluginDir: string,
  enabled = true,
  disabledPlugins: string[] = [],
): void {
  const registryDir = join(projectDir, '.mastracode', 'plugins');
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(
    join(registryDir, 'plugins.json'),
    JSON.stringify(
      {
        disabledPlugins,
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

function writeGithubPluginRegistry(projectDir: string, checkoutName: string): void {
  const registryDir = join(projectDir, '.mastracode', 'plugins');
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(
    join(registryDir, 'plugins.json'),
    JSON.stringify(
      {
        plugins: {
          [PLUGIN_ID]: {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/github-poll-plugin',
            path: `sources/github/${checkoutName}`,
            entry: 'src/index.ts',
          },
        },
      },
      null,
      2,
    ),
  );
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function prepareGithubPollPlugin(projectDir: string): string {
  const sourceDir = join(projectDir, 'fixtures', 'plugins', 'github-poll-source');
  const remoteDir = join(projectDir, 'fixtures', 'plugins', 'github-poll-remote.git');
  const checkoutName = 'acme-github-poll-plugin';
  const checkoutDir = join(projectDir, '.mastracode', 'plugins', 'sources', 'github', checkoutName);

  writeHotReloadPluginSource(sourceDir, 'version-one');
  git(sourceDir, ['init', '-b', 'main']);
  git(sourceDir, ['config', 'user.email', 'e2e@example.com']);
  git(sourceDir, ['config', 'user.name', 'Mastra Code E2E']);
  git(sourceDir, ['add', '.']);
  git(sourceDir, ['commit', '-m', 'initial plugin']);
  git(projectDir, ['init', '--bare', remoteDir]);
  git(sourceDir, ['remote', 'add', 'origin', remoteDir]);
  git(sourceDir, ['push', '-u', 'origin', 'main']);
  mkdirSync(dirname(checkoutDir), { recursive: true });
  git(projectDir, ['clone', '-b', 'main', remoteDir, checkoutDir]);
  writeGithubPluginRegistry(projectDir, checkoutName);

  return sourceDir;
}

function pushGithubPollPluginUpdate(sourceDir: string): void {
  writeHotReloadPluginSource(sourceDir, 'version-two');
  git(sourceDir, ['add', '.']);
  git(sourceDir, ['commit', '-m', 'update plugin result']);
  git(sourceDir, ['push']);
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
    resetPluginScenarioState();
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
    resetPluginScenarioState();
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
    resetPluginScenarioState();
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
    resetPluginScenarioState();
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
    writeHotReloadPluginSource(hotReloadPluginDir, 'version-two');

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
    // The run() screen assertions wait for version-one and version-two, while the second AIMock follow-up response
    // deliberately avoids version-two. That ensures the visible updated version comes from the plugin tool result.
  },
};

export const pluginsGithubPollUpdateScenario: McE2eScenario = {
  name: 'plugins-github-poll-update',
  description: 'Polls a GitHub-installed plugin checkout and reloads updated tool code in the same TUI session.',
  testName: 'polls GitHub plugin updates in the same TUI session',
  useOpenAIModel: true,
  aimockFixture: 'plugins-github-poll-update.json',
  prepare({ projectDir }) {
    resetPluginScenarioState();
    githubPollSourceDir = prepareGithubPollPlugin(projectDir);
  },
  async inProcessApp({ homeDir, projectDir, startMastraCodeApp }) {
    const { PluginManager } = await import('../../src/plugins/manager.js');
    const manager = new PluginManager({ projectRoot: projectDir, configDir: '.mastracode', homeDir });
    githubPollManager = manager;
    return startMastraCodeApp({
      config: {
        pluginManager: manager,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('Call the GitHub plugin before update.');
    await runtime.waitForScreenText(/version-one/i, terminal, 10_000);

    if (!githubPollSourceDir) throw new Error('GitHub poll plugin source directory was not prepared');
    if (!githubPollManager) throw new Error('GitHub poll plugin manager was not initialized');
    pushGithubPollPluginUpdate(githubPollSourceDir);
    const changed = await githubPollManager.pollGithubSourcesForUpdates();
    if (!changed) throw new Error('Expected GitHub plugin poll to detect an update');

    terminal.submit('Call the GitHub plugin after update.');
    await runtime.waitForScreenText(/version-two/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const names = getToolNames(requests);
    if (!names.includes(TOOL_NAME)) {
      throw new Error(
        `Expected provider request to expose GitHub poll plugin tool ${TOOL_NAME}. Names: ${names.join(', ')}`,
      );
    }
    // The run() screen assertions wait for version-one and version-two, while the AIMock fixture responses deliberately
    // avoid those strings. That ensures the visible text comes from the plugin tool results, not mocked model prose.
  },
};

export const pluginsBlockedConfigScenario: McE2eScenario = {
  name: 'plugins-blocked-config',
  description: 'Blocks an installed plugin through plugins.json disabledPlugins.',
  testName: 'shows configured plugin blocks and hides blocked tools',
  prepare({ projectDir }) {
    resetPluginScenarioState();
    const pluginDir = writeLocalPlugin({ projectDir });
    writePluginRegistry(projectDir, pluginDir, true, [PLUGIN_ID]);
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
    await runtime.waitForScreenText(new RegExp(PLUGIN_ID), terminal, 8_000);
    await runtime.waitForScreenText(/blocked/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/│ ›/i, terminal, 8_000);

    terminal.submit(`/plugins ${PLUGIN_ID}`);
    await runtime.waitForScreenText(/blocked by plugins\.json disabledPlugins/i, terminal, 8_000);
    await runtime.waitForScreenText(/tools:\s*\(none\)/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
};

export const pluginsAssetsLoadingScenario: McE2eScenario = {
  name: 'plugins-assets-loading',
  description: 'Loads commands and skills bundled by an installed plugin and exposes them through slash autocomplete.',
  testName: 'loads bundled plugin commands and skills with autocomplete entries',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'plugins-assets-loading.json',
  prepare({ projectDir }) {
    resetPluginScenarioState();
    const pluginDir = writeAssetPlugin({ projectDir });
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
    await runtime.waitForScreenText(/Project: project/i, terminal, 15_000);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);

    terminal.submit('/help');
    await runtime.waitForScreenText(/Custom Commands/i, terminal, 8_000);
    await runtime.waitForScreenText(/\/\/e2e-plugin-assets/i, terminal, 8_000);
    await runtime.waitForScreenText(/E2E plugin bundled command autocomplete description/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.sleep(100);

    terminal.submit('/skills');
    await runtime.waitForScreenText(/e2e-plugin-asset-skill/i, terminal, 10_000);
    await runtime.waitForScreenText(/E2E plugin bundled skill autocomplete description/i, terminal, 10_000);

    await typeTextSlowly(terminal, '/e2e-plugin-a');
    await runtime.waitForScreenText(/E2E plugin bundled command autocomplete description/i, terminal, 20_000);
    runtime.printScreen('plugin command autocomplete', terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/E2E plugin bundled command executed\./i, terminal, 15_000);
    await runtime.waitForScreenText(/MC plugin bundled command response/i, terminal, 15_000);

    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);
    await typeTextSlowly(terminal, '/skill/e2e-plugin');
    await runtime.waitForScreenText(/E2E plugin bundled skill autocomplete description/i, terminal, 20_000);
    runtime.printScreen('plugin skill autocomplete', terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/MC plugin bundled skill response/i, terminal, 15_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const body = JSON.stringify(requests);
    if (!body.includes('E2E plugin bundled command executed.')) {
      throw new Error(`Expected plugin bundled command template in AIMock requests: ${body.slice(0, 2000)}`);
    }
    if (!body.includes('E2E plugin bundled skill instructions.')) {
      throw new Error(`Expected plugin bundled skill instructions in AIMock requests: ${body.slice(0, 2000)}`);
    }
  },
};

export const pluginsCommandUiScenario: McE2eScenario = {
  name: 'plugins-command-ui',
  description: 'Shows installed plugins and plugin details in the /plugins TUI command.',
  testName: 'renders plugin list and detail screens',
  prepare({ projectDir }) {
    resetPluginScenarioState();
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
