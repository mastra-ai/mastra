import type { McE2eScenario } from './types.js';

export const mcpServerConfigScenario = {
  name: 'mcp-server-config',
  description: 'shows programmatic MCP server configuration in the real TUI status command',
  testName: 'renders configured stdio MCP servers in /mcp status through the real TUI',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: false,
        mcpServers: {
          e2e_stdio_config: {
            args: ['-e', 'process.stderr.write("mcp e2e configured server\\n"); process.exit(1);'],
            command: process.execPath,
            env: {},
          },
        },
        unixSocketPubSub: false,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/MCP: Failed to connect to "e2e_stdio_config"/i, terminal, 10_000);

    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/e2e_stdio_config \[stdio\] \(error:/i, terminal);
    await runtime.waitForScreenText(/\/mcp reload - Disconnect and reconnect all servers/i, terminal);
    runtime.printScreen('mcp server config status', terminal);
  },
} satisfies McE2eScenario;
