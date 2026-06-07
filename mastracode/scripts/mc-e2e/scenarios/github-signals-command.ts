import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const githubSignalsCommandScenario = {
  name: 'github-signals-command',
  description: 'opens the GitHub Signals command surface through the real TUI with experimental signals enabled',
  testName: 'renders GitHub Signals debug status in the real TUI',
  prepare({ appDataDir, mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });

    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.signals = {
      ...settings.signals,
      experimentalGithubSignals: true,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    writeFileSync(
      join(projectDir, '.mc-e2e-github-signals-entrypoint.ts'),
      `import { join } from 'node:path';\nimport { pathToFileURL } from 'node:url';\n\nconst mastracodeDir = ${JSON.stringify(mastracodeDir)};\nconst { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);\nconst { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);\nconst { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);\n\nprocess.on('SIGINT', () => process.exit(0));\nprocess.on('SIGTERM', () => process.exit(0));\n\nconst result = await createMastraCode({\n  cwd: process.cwd(),\n  disableMcp: true,\n  disableHooks: true,\n  unixSocketPubSub: false,\n});\n\nawait result.harness.createThread({ title: 'GitHub Signals e2e thread' });\n\nconst tui = new MastraTUI({\n  harness: result.harness,\n  hookManager: result.hookManager,\n  authStorage: result.authStorage,\n  mcpManager: result.mcpManager,\n  appName: 'Mastra Code',\n  version: getCurrentVersion(),\n  inlineQuestions: true,\n  githubSignals: result.githubSignals,\n});\n\nvoid tui.run().catch(error => {\n  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');\n  process.exit(1);\n});\n`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-github-signals-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/github debug');
    await runtime.waitForScreenText(/GitHub Signals debug for/i, terminal);
    await runtime.waitForScreenText(/no subscribed PRs/i, terminal);
    runtime.printScreen('github debug no subscriptions', terminal);
  },
} satisfies McE2eScenario;
