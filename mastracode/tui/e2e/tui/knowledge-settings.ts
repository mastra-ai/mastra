import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { selectMenuRow } from './menu-navigation.js';
import type { McE2eScenario } from './types.js';

export const knowledgeSettingsScenario: McE2eScenario = {
  name: 'knowledge-settings',
  description: 'Turn Knowledge on and off through /settings; it stays off until then and changes on restart.',
  testName: 'persists the Knowledge toggle with a restart notice',
  env({ appDataDir }) {
    return { MC_E2E_KNOWLEDGE_SETTINGS_PATH: join(appDataDir, 'settings.json') };
  },
  async run({ terminal, runtime }) {
    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);
    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'knowledge-settings',
    ) as { env?: Record<string, string | null> } | undefined;
    const settingsPath = runConfig?.env?.MC_E2E_KNOWLEDGE_SETTINGS_PATH;
    if (!settingsPath) throw new Error('Missing Knowledge settings path');
    const readSettings = () => JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (readSettings().signals?.experimentalKnowledge === true) throw new Error('Knowledge must default off');

    // Off: /knowledge is not a command.
    terminal.submit('/knowledge');
    await runtime.waitForScreenText(/Unknown command: \/knowledge/i, terminal);

    terminal.submit('/settings');
    await selectMenuRow(terminal, /Experimental Knowledge/i);
    await runtime.waitForScreenText(/Add knowledge_search, knowledge_read/i, terminal);
    terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental Knowledge\s+On/i, terminal);
    if (readSettings().signals?.experimentalKnowledge !== true) throw new Error('Knowledge was not saved as on');
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Experimental Knowledge: on \(restart required\)/i, terminal);

    terminal.submit('/settings');
    await selectMenuRow(terminal, /Experimental Knowledge/i);
    await runtime.waitForScreenText(/No Knowledge tools or pinned context/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental Knowledge\s+Off/i, terminal);
    if (readSettings().signals?.experimentalKnowledge !== false) throw new Error('Knowledge was not saved as off');
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Experimental Knowledge: off \(restart required\)/i, terminal);
  },
};
