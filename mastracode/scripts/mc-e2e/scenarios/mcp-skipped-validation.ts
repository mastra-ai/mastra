import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const mcpSkippedValidationScenario = {
  name: 'mcp-skipped-validation',
  description: 'Shows skipped MCP server validation reasons in status text and the interactive selector.',
  testName: 'renders skipped MCP validation reasons through /mcp status and selector',
  projectFixture: 'long-branch',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, '.mastracode'), { recursive: true });
    writeFileSync(
      join(projectDir, '.mastracode', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            ambiguous_entry: {
              command: process.execPath,
              url: 'http://127.0.0.1:65534/mcp',
            },
            malformed_url: {
              url: 'not a valid url',
            },
            bad_oauth_redirect: {
              url: 'http://127.0.0.1:65534/mcp',
              oauth: {
                redirectUrl: 'http://example.com/callback',
              },
            },
            missing_entry_fields: {},
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(projectDir, '.mc-e2e-mcp-skipped-entrypoint.ts'),
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
    return join(projectDir, '.mc-e2e-mcp-skipped-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/MCP Servers:/i, terminal, 8_000);
    await runtime.waitForScreenText(/Skipped:/i, terminal, 8_000);
    await runtime.waitForScreenText(/ambiguous_entry: Cannot specify both "command" and "url"/i, terminal, 8_000);
    await runtime.waitForScreenText(/malformed_url: Invalid URL: "not a valid url"/i, terminal, 8_000);
    await runtime.waitForScreenText(/bad_oauth_redirect: Invalid OAuth redirectUrl: must use HTTPS/i, terminal, 8_000);
    await runtime.waitForScreenText(/missing_entry_fields: Missing required field: "command" \(stdio\) or "url" \(http\)/i, terminal, 8_000);

    terminal.submit('/mcp');
    await runtime.waitForScreenText(/Manage MCP servers/i, terminal, 8_000);
    await runtime.waitForScreenText(/4 servers/i, terminal, 8_000);
    await runtime.waitForScreenText(/Skipped:/i, terminal, 8_000);
    await runtime.waitForScreenText(/ambiguous_entry — Cannot specify both "command" and "url"/i, terminal, 8_000);
    await runtime.waitForScreenText(/malformed_url — Invalid URL: "not a valid url"/i, terminal, 8_000);
    await runtime.waitForScreenText(/bad_oauth_redirect — Invalid OAuth redirectUrl: must use HTTPS/i, terminal, 8_000);
    await runtime.waitForScreenText(/missing_entry_fields — Missing required field: "command" \(stdio\) or "url" \(http\)/i, terminal, 8_000);
    runtime.printScreen('mcp skipped validation selector', terminal);
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
