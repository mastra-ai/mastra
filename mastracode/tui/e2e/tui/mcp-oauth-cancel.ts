import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpOAuthFixtureServer } from './mcp-oauth-fixture.js';
import type { McpOAuthFixture } from './mcp-oauth-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

export const mcpOauthCancelScenario = {
  name: 'mcp-oauth-cancel',
  description:
    'Starts authenticating a bare-url OAuth MCP server, then cancels the pending flow from the selector and confirms the server returns to needs-auth.',
  testName: 'cancels a pending MCP OAuth authentication from the interactive selector overlay',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    mkdirSync(join(projectDir, '.mastracode'), { recursive: true });
  },
  async inProcessApp({ projectDir, startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    // Never spawn a real browser from the e2e run.
    patches.setEnv('MASTRA_MCP_OAUTH_NO_BROWSER', '1');
    // Hold the authorize endpoint open so the client's OAuth flow stays pending,
    // giving the scenario a deterministic window to cancel before any code is issued.
    let fixtureServer: McpOAuthFixture | undefined = await startMcpOAuthFixtureServer({
      name: 'mc-e2e-oauth-cancel-mcp',
      holdAuthorize: true,
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
    const server = fixtureServer;

    writeFileSync(
      join(projectDir, '.mastracode', 'mcp.json'),
      JSON.stringify({ mcpServers: { oauth_server: { url: server.url } } }, null, 2),
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
            // Release any held authorize request before tearing the server down.
            fixtureServer?.releaseAuthorize();
            await fixtureServer?.close();
            fixtureServer = undefined;
          }
        },
      };
    } catch (error) {
      server.releaseAuthorize();
      await server.close();
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    terminal.resize(400, 50);

    // A server that only needs OAuth shows the needs-auth notification at
    // startup, not a raw connect error.
    await runtime.waitForScreenText(
      /MCP: .*"oauth_server" needs authentication .* run \/mcp to authenticate/i,
      terminal,
      15_000,
    );
    await runtime.waitForScreenTextAbsent(/MCP: Failed to connect to "oauth_server"/i, terminal, 2_000);

    terminal.submit('/mcp');
    await runtime.waitForScreenText(/Manage MCP servers/i, terminal, 8_000);
    await runtime.waitForScreenText(/oauth_server \[http\] needs auth/i, terminal, 8_000);

    // Open the sub-menu and start authentication (Authenticate is the first action).
    terminal.write('\r');
    await runtime.waitForScreenText(/Authenticate/i, terminal, 8_000);
    terminal.write('\r');

    // The authorize endpoint is held open, so the flow parks. The selector
    // surfaces the cancel affordance in the row state and auto-opens the
    // "Cancel authentication" sub-menu, pre-selected, so Enter backs out.
    await runtime.waitForScreenText(/oauth_server \[http\] authenticating — Enter to cancel/i, terminal, 8_000);
    await runtime.waitForScreenText(/Cancel authentication/i, terminal, 8_000);

    // Hold long enough to span several 500ms selector poll cycles. The
    // authenticating affordance is derived from the in-flight flow, not the
    // polled `connecting` flag, so it must survive status refreshes from the
    // manager without reverting the row to needs-auth or dropping the sub-menu.
    await new Promise(resolve => setTimeout(resolve, 1_600));
    await runtime.waitForScreenText(/oauth_server \[http\] authenticating — Enter to cancel/i, terminal, 8_000);
    await runtime.waitForScreenText(/Cancel authentication/i, terminal, 8_000);

    // Close the selector entirely (Esc closes the sub-menu, Esc closes the
    // overlay) while the flow is still pending, then reopen /mcp. The reopened
    // selector is a fresh instance with an empty local set, so it can only know
    // the flow is still in flight from the manager-owned `authenticating` status
    // — it must still surface the cancel affordance.
    terminal.write('\x1b');
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage MCP servers/i, terminal, 8_000);
    terminal.submit('/mcp');
    await runtime.waitForScreenText(/Manage MCP servers/i, terminal, 8_000);
    await runtime.waitForScreenText(/oauth_server \[http\] authenticating — Enter to cancel/i, terminal, 8_000);

    // Open the sub-menu on the still-authenticating server and cancel.
    terminal.write('\r');
    await runtime.waitForScreenText(/Cancel authentication/i, terminal, 8_000);
    terminal.write('\r');

    // A deliberate cancel shows the cancel confirmation, then the aborted flow
    // settles the server back to needs-auth.
    await runtime.waitForScreenText(/Cancelled authentication for "oauth_server"/i, terminal, 8_000);

    // Cancelling aborts the pending flow and returns the server to needs-auth.
    await runtime.waitForScreenText(/oauth_server \[http\] needs auth/i, terminal, 10_000);

    // The "Failed to authenticate" toast decision is made when the auth promise
    // settles — which has already happened now that the row reads needs-auth
    // above. Asserting its absence here is a settled-state check, not a race
    // window: the deliberate cancel must never stack a failure toast.
    await runtime.waitForScreenTextAbsent(/Failed to authenticate "oauth_server"/i, terminal, 2_000);
    runtime.printScreen('mcp selector after cancelling oauth authenticate', terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage MCP servers/i, terminal, 8_000);
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
