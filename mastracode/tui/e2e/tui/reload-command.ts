import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpHttpFixtureServer } from './mcp-http-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';
import { typeTextSlowly } from './typing-utils.js';

const SKILL_NAME = 'reload-skill-e2e';
const COMMAND_NAME = 'reload-cmd-e2e';
const HOOK_DESCRIPTION = 'reload hook e2e';

export const reloadCommandScenario: McE2eScenario = {
  name: 'reload-command',
  description: 'Add a skill, custom command, hook, and MCP server on disk mid-session and pick them up with /reload.',
  testName: 'reloads skills, custom commands, hooks, and MCP servers added after startup',
  projectFixture: 'long-branch',
  env() {
    return { MASTRACODE_DISABLE_HOOKS: '0' };
  },
  prepare({ projectDir }) {
    // Staged outside .mastracode so nothing is discovered at startup.
    const staged = join(projectDir, 'reload-staged');
    mkdirSync(join(staged, 'skills', SKILL_NAME), { recursive: true });
    mkdirSync(join(staged, 'commands'), { recursive: true });
    writeFileSync(
      join(staged, 'skills', SKILL_NAME, 'SKILL.md'),
      `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_NAME} description\nuser-invocable: true\n---\nReload skill body.\n`,
    );
    writeFileSync(join(staged, 'commands', `${COMMAND_NAME}.md`), `---\ndescription: Reload command e2e\n---\nHi\n`);
    writeFileSync(
      join(staged, 'hooks.json'),
      JSON.stringify({ Stop: [{ type: 'command', command: 'true', description: HOOK_DESCRIPTION }] }, null, 2),
    );
  },
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const fixtureServer = await startMcpHttpFixtureServer({
      headerName: 'x-mc-e2e',
      headerValue: 'reload-command',
      name: 'mc-e2e-reload-command-mcp',
      registerTools: server => {
        server.tool('reload_command_probe', 'Reload command e2e probe.', { label: z.string().default('x') }, () => ({
          content: [{ type: 'text', text: 'ok' }],
        }));
      },
    });
    patches.setEnv('MC_E2E_RELOAD_MCP_URL', fixtureServer.url);

    try {
      const app = await startMastraCodeApp({
        config: { disableHooks: false, disableMcp: false, unixSocketPubSub: false },
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
    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/hooks');
    await runtime.waitForScreenText(/No hooks configured/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); fs.cpSync("reload-staged",".mastracode",{recursive:true}); fs.writeFileSync(".mastracode/mcp.json", JSON.stringify({mcpServers:{reload_cmd:{url:process.env.MC_E2E_RELOAD_MCP_URL,headers:{"x-mc-e2e":"reload-command"}}}})); console.log("RELOAD_FILES_COPIED");'`,
    );
    await runtime.waitForScreenText(/RELOAD_FILES_COPIED/, terminal, 10_000);

    terminal.submit('/reload');
    await runtime.waitForScreenText(
      /Reloaded: [^\n]*1 skill\(s\), 1 command\(s\), hooks, 1 MCP server\(s\), 1 MCP tool\(s\)/i,
      terminal,
      15_000,
    );
    runtime.printScreen('after /reload', terminal);

    terminal.submit('/skills');
    await runtime.waitForScreenText(new RegExp(`${SKILL_NAME} description`, 'i'), terminal, 8_000);

    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/reload_cmd \[http\] \(connected\)/i, terminal, 10_000);

    terminal.submit('/hooks');
    await runtime.waitForScreenText(new RegExp(HOOK_DESCRIPTION, 'i'), terminal, 8_000);

    await terminal.flushInput?.();
    await typeTextSlowly(terminal, `//${COMMAND_NAME.slice(0, 10)}`);
    await runtime.waitForScreenText(new RegExp(`/${COMMAND_NAME}`, 'i'), terminal, 10_000);
    runtime.printScreen('custom command autocomplete after reload', terminal);
    terminal.write('\x1b');
    terminal.write('\x15');

    terminal.keyCtrlC();
  },
};
