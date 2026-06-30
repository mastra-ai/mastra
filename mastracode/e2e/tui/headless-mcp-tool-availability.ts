import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { expect } from './expect.js';
import { startMcpHttpFixtureServer } from './mcp-http-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

async function startHeadlessMcpFixtureServer() {
  let delayedInitialConnection = false;
  return startMcpHttpFixtureServer({
    beforeRequest: async () => {
      if (delayedInitialConnection) return undefined;
      delayedInitialConnection = true;
      await new Promise(resolve => setTimeout(resolve, 1500));
      return undefined;
    },
    headerName: 'x-mc-e2e',
    headerValue: 'headless-mcp',
    name: 'mc-e2e-headless-mcp',
    registerTools: server => {
      server.tool(
        'delayed_lookup',
        'Return a deterministic payload from a headless MCP tool.',
        { query: z.string().describe('Lookup query') },
        input => ({
          content: [{ type: 'text', text: `MC_HEADLESS_MCP_RESULT:${String(input.query)}:ok` }],
        }),
      );
    },
  });
}

function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}

async function runHeadlessInProcess(terminal: { write: (text: string) => void }): Promise<void> {
  const previousArgv = process.argv;
  const previousStdoutWrite = process.stdout.write;
  const previousStderrWrite = process.stderr.write;
  const previousExit = process.exit;

  process.argv = [
    process.argv[0] ?? 'node',
    'headless-mcp-e2e',
    '--prompt',
    'Use the delayed headless MCP lookup tool and report its payload.',
    '--output',
    'human',
    '--timeout',
    '30',
  ];

  process.stdout.write = ((
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) => {
    terminal.write(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    if (typeof encodingOrCallback === 'function') encodingOrCallback();
    else callback?.();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) => {
    terminal.write(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    if (typeof encodingOrCallback === 'function') encodingOrCallback();
    else callback?.();
    return true;
  }) as typeof process.stderr.write;
  process.exit = ((code?: string | number | null | undefined) => {
    throw new Error(`MC_E2E_HEADLESS_EXIT:${code ?? 0}`);
  }) as typeof process.exit;

  try {
    const { runMCCli } = await import('../../src/headless/index.js');
    await runMCCli();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('MC_E2E_HEADLESS_EXIT:0')) throw error;
  } finally {
    process.argv = previousArgv;
    process.stdout.write = previousStdoutWrite;
    process.stderr.write = previousStderrWrite;
    process.exit = previousExit;
  }
}

export const headlessMcpToolAvailabilityScenario = {
  name: 'headless-mcp-tool-availability',
  description: 'Verifies headless mode waits for MCP tools before sending the first model request.',
  testName: 'makes MCP tools available to the first headless model turn',
  useOpenAIModel: true,
  aimockFixture: 'headless-mcp-tool-availability.json',
  async inProcessApp({ homeDir, terminal }): Promise<McE2eInProcessApp> {
    const fixtureServer = await startHeadlessMcpFixtureServer();
    const mcpConfigDir = join(homeDir, '.mastracode');
    mkdirSync(mcpConfigDir, { recursive: true });
    writeFileSync(
      join(mcpConfigDir, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          e2e_headless_mcp: {
            url: fixtureServer.url,
            headers: { 'x-mc-e2e': 'headless-mcp' },
          },
        },
      }),
    );

    const headlessRun = runHeadlessInProcess(terminal);
    return {
      stop: async () => {
        await headlessRun;
        await fixtureServer.close();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(
      /Headless MCP lookup completed with payload MC_HEADLESS_MCP_RESULT:headless-e2e:ok/i,
      terminal,
      35_000,
    );
    runtime.printScreen('headless mcp tool availability', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('Use the delayed headless MCP lookup tool and report its payload.');
    expect(serialized).toContain('e2e_headless_mcp_delayed_lookup');
    expect(serialized).toContain('MC_HEADLESS_MCP_RESULT:headless-e2e:ok');
  },
} satisfies McE2eScenario;
