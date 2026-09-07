import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const webSearchProviderSettingsScenario = {
  name: 'web-search-provider-settings',
  description: 'selects a web search provider in /settings, with missing-key providers shown but not selectable',
  testName: 'persists an available web search provider and blocks unavailable ones',
  env() {
    return {
      TAVILY_API_KEY: 'mc-e2e-tavily-key',
      PARALLEL_API_KEY: '',
    };
  },
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.preferences = {
      ...settings.preferences,
      quietMode: false,
      webSearchProvider: 'auto',
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Settings/i, terminal);
    await runtime.waitForScreenText(/Web search provider\s+Auto/i, terminal);
    runtime.printScreen('web search provider initial', terminal);

    terminal.write('\x1b[B'.repeat(5));
    terminal.write('\r');
    await runtime.waitForScreenText(/Missing PARALLEL_API_KEY/i, terminal);
    await runtime.waitForScreenText(/Parallel \(unavailable\)/i, terminal);
    runtime.printScreen('provider submenu open', terminal);

    // Selecting the provider whose key is missing is a no-op: the submenu stays open.
    terminal.write('\x1b[B'.repeat(2));
    terminal.write('\r');
    await runtime.waitForScreenText(/Missing PARALLEL_API_KEY/i, terminal);
    runtime.printScreen('unavailable provider blocked', terminal);

    // Tavily has its key configured, so selecting it persists.
    terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Web search provider\s+Tavily/i, terminal);
    runtime.printScreen('tavily selected', terminal);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Settings/i, terminal, 8_000);
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Web search provider\s+Tavily/i, terminal);
    runtime.printScreen('web search provider reopened', terminal);
  },
} satisfies McE2eScenario;
