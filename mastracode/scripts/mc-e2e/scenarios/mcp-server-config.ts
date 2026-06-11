import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const mcpServerConfigScenario = {
  name: 'mcp-server-config',
  description: 'shows programmatic MCP server configuration in the real TUI status command',
  testName: 'renders configured stdio MCP servers in /mcp status through the real TUI',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-mcp-config-entrypoint.ts'),
      `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const result = await createMastraCode({
  cwd: process.cwd(),
  disableHooks: true,
  unixSocketPubSub: false,
  mcpServers: {
    e2e_stdio_config: {
      command: process.execPath,
      args: ['-e', 'process.stderr.write("mcp e2e configured server\\n"); process.exit(1);'],
      env: {},
    },
  },
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Mastra Code',
  version: getCurrentVersion(),
  inlineQuestions: true,
  githubSignals: result.githubSignals,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-mcp-config-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/MCP: Failed to connect to "e2e_stdio_config"/i, terminal, 10_000);

    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/MCP Servers:/i, terminal);
    await runtime.waitForScreenText(/e2e_stdio_config \[stdio\] \(error:/i, terminal);
    await runtime.waitForScreenText(/\/mcp reload - Disconnect and reconnect all servers/i, terminal);
    runtime.printScreen('mcp server config status', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
} satisfies McE2eScenario;
