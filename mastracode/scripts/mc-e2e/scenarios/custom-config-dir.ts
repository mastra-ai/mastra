import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

const CONFIG_DIR = '.acme-code';

export const customConfigDirScenario: McE2eScenario = {
  name: 'custom-config-dir',
  description:
    'Launch an embedded TUI with createMastraCode({ configDir }) and verify config-backed commands and skills.',
  testName: 'uses a programmatic configDir for TUI custom commands and skills',
  projectFixture: 'long-branch',
  prepare({ mastracodeDir, projectDir }) {
    const configRoot = join(projectDir, CONFIG_DIR);
    mkdirSync(join(configRoot, 'commands'), { recursive: true });
    mkdirSync(join(configRoot, 'skills', 'acme-skill'), { recursive: true });
    mkdirSync(join(projectDir, '.mastracode', 'commands'), { recursive: true });
    mkdirSync(join(projectDir, '.mastracode', 'skills', 'default-skill'), { recursive: true });

    writeFileSync(
      join(configRoot, 'commands', 'acme.md'),
      `---\ndescription: Custom configDir command\n---\nCustom command from .acme-code\n`,
    );
    writeFileSync(
      join(projectDir, '.mastracode', 'commands', 'default-only.md'),
      `---\ndescription: Default config command should not load\n---\nWrong configDir command\n`,
    );
    writeFileSync(
      join(configRoot, 'skills', 'acme-skill', 'SKILL.md'),
      `---\nname: acme-skill\ndescription: Custom configDir skill\nuser-invocable: true\n---\nUse custom configDir skill instructions.\n`,
    );
    writeFileSync(
      join(projectDir, '.mastracode', 'skills', 'default-skill', 'SKILL.md'),
      `---\nname: default-skill\ndescription: Default configDir skill should not load\nuser-invocable: true\n---\nWrong configDir skill.\n`,
    );

    writeFileSync(
      join(projectDir, '.mc-e2e-custom-config-entrypoint.ts'),
      `import { join } from 'node:path';\nimport { pathToFileURL } from 'node:url';\n\nconst mastracodeDir = ${JSON.stringify(mastracodeDir)};\nconst { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);\nconst { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);\nconst { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);\n\nprocess.on('SIGINT', () => process.exit(0));\nprocess.on('SIGTERM', () => process.exit(0));\n\nconst result = await createMastraCode({\n  cwd: process.cwd(),\n  configDir: '${CONFIG_DIR}',\n  disableMcp: true,\n  disableHooks: true,\n  unixSocketPubSub: false,\n  memory: false,\n});\n\nconst tui = new MastraTUI({\n  harness: result.harness,\n  hookManager: result.hookManager,\n  authStorage: result.authStorage,\n  mcpManager: result.mcpManager,\n  appName: 'Acme Code',\n  version: getCurrentVersion(),\n  inlineQuestions: true,\n});\n\nvoid tui.run().catch(error => {\n  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');\n  process.exit(1);\n});\n`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-custom-config-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Acme Code|Project:|Resource ID:/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/help');
    await runtime.waitForScreenText(/Custom Commands/i, terminal);
    await runtime.waitForScreenText(/\/\/acme/i, terminal);
    await runtime.waitForScreenText(/Custom configDir command/i, terminal);
    const helpScreen = terminal.serialize().view;
    expect(helpScreen).not.toMatch(/default-only/i);
    runtime.printScreen('after /help', terminal);

    terminal.submit('/skills');
    await runtime.waitForScreenText(/Skills \(1\):/i, terminal);
    await runtime.waitForScreenText(/acme-skill/i, terminal);
    await runtime.waitForScreenText(/Custom configDir skill/i, terminal);
    const skillsScreen = terminal.serialize().view;
    expect(skillsScreen).not.toMatch(/default-skill/i);
    runtime.printScreen('after /skills', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
