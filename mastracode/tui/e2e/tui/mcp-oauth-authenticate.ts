import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpOAuthFixtureServer } from './mcp-oauth-fixture.js';
import type { McE2eInProcessApp, McE2eScenario, McE2eTerminal } from './types.js';

/** Grab a currently-free port so the pinned `callbackPort` never collides in CI. */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

let pinnedCallbackPort: number;

function extractAuthorizationUrl(terminal: McE2eTerminal): string {
  const view = terminal.serialize().view;
  const match = view.match(/http:\/\/127\.0\.0\.1:\d+\/authorize\?\S+/);
  if (!match) {
    throw new Error(`authorization URL not found on screen:\n${view}`);
  }
  return match[0];
}

export const mcpOauthAuthenticateScenario = {
  name: 'mcp-oauth-authenticate',
  description:
    'Authenticates a bare-url OAuth-protected HTTP MCP server from the /mcp selector, with the harness acting as the browser.',
  testName: 'authenticates an OAuth MCP server from the interactive selector overlay',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    mkdirSync(join(projectDir, '.mastracode'), { recursive: true });
  },
  async inProcessApp({ projectDir, startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    // Never spawn a real browser from the e2e run — the harness fetches the URL.
    patches.setEnv('MASTRA_MCP_OAUTH_NO_BROWSER', '1');
    const fixtureServer = await startMcpOAuthFixtureServer({
      name: 'mc-e2e-oauth-mcp',
      registerTools: server => {
        server.tool(
          'oauth_probe',
          'Return the deterministic MCP OAuth e2e probe payload.',
          { label: z.string().default('oauth') },
          input => ({
            content: [{ type: 'text', text: `MC_MCP_OAUTH_TOOL:${String(input.label)}:ok` }],
          }),
        );
      },
    });

    // Exercise the `callbackPort` shorthand end-to-end: the client must
    // synthesize `http://localhost:<port>/callback`, bind its loopback
    // callback server on that exact port, and complete the flow through it.
    pinnedCallbackPort = await findFreePort();
    writeFileSync(
      join(projectDir, '.mastracode', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            oauth_server: { url: fixtureServer.url, oauth: { callbackPort: pinnedCallbackPort } },
          },
        },
        null,
        2,
      ),
    );

    try {
      const app = await startMastraCodeApp({
        config: {
          disableHooks: true,
          disableMcp: false,
          unixSocketPubSub: false,
        },
      });

      return {
        stop: async () => {
          try {
            await patches.stopApp(app.stop);
          } finally {
            await fixtureServer.close();
          }
        },
      };
    } catch (error) {
      await fixtureServer.close();
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    // Wide terminal so the authorization URL renders unwrapped on one line.
    terminal.resize(400, 50);

    // A server that only needs OAuth is a notification, not an error: the
    // startup line names the server and points at /mcp instead of dumping the
    // raw connect failure.
    await runtime.waitForScreenText(
      /MCP: .*"oauth_server" needs authentication .* run \/mcp to authenticate/i,
      terminal,
      15_000,
    );
    await runtime.waitForScreenTextAbsent(/MCP: Failed to connect to "oauth_server"/i, terminal, 2_000);

    terminal.submit('/mcp');
    await runtime.waitForScreenText(/Manage MCP servers/i, terminal, 8_000);
    await runtime.waitForScreenText(/oauth_server \[http\] needs auth/i, terminal, 8_000);

    // Open the sub-menu; Authenticate is the first action.
    terminal.write('\r');
    await runtime.waitForScreenText(/Authenticate/i, terminal, 8_000);
    terminal.write('\r');

    // Starting the flow auto-opens the "Cancel authentication" sub-menu; the
    // first Esc closes that sub-menu, the second closes the selector overlay so
    // the printed authorization URL is visible on screen.
    await runtime.waitForScreenText(/Cancel authentication/i, terminal, 8_000);
    terminal.write('\x1b');
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage MCP servers/i, terminal, 8_000);
    await runtime.waitForScreenText(/MCP: To authenticate "oauth_server", open:/i, terminal, 15_000);

    // Act as the browser: follow the authorize redirect back to the loopback
    // callback server started by the client's OAuth flow.
    const authorizationUrl = extractAuthorizationUrl(terminal);

    // The authorize request must carry the redirect URL synthesized from the
    // pinned `callbackPort` — proving the shorthand flows TUI config → manager
    // → provider → authorization request, not just through unit-level parsing.
    const redirectUri = new URL(authorizationUrl).searchParams.get('redirect_uri');
    if (redirectUri !== `http://localhost:${pinnedCallbackPort}/callback`) {
      throw new Error(
        `expected redirect_uri http://localhost:${pinnedCallbackPort}/callback from callbackPort shorthand, got: ${redirectUri}`,
      );
    }

    const callbackResponse = await fetch(authorizationUrl, { redirect: 'follow' });
    if (!callbackResponse.ok) {
      throw new Error(`OAuth callback failed: HTTP ${callbackResponse.status}`);
    }

    await runtime.waitForScreenText(/MCP: Authenticated "oauth_server" — 1 tool\(s\)/i, terminal, 15_000);

    terminal.submit('/mcp');
    await runtime.waitForScreenText(/oauth_server \[http\] connected.*1 tools/i, terminal, 8_000);
    runtime.printScreen('mcp selector after oauth authenticate', terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage MCP servers/i, terminal, 8_000);
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
