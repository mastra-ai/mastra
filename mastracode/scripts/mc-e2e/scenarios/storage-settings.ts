import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const storageSettingsScenario: McE2eScenario = {
  name: 'storage-settings',
  description: 'Exercise storage backend settings overlay through the real TUI.',
  testName: 'sets PostgreSQL storage backend with masked connection input in the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Settings/i, terminal);
    await runtime.waitForScreenText(/Storage backend/i, terminal);
    runtime.printScreen('after /settings', terminal);

    terminal.write('\x1b[B'.repeat(6));
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/LibSQL/i, terminal);
    await runtime.waitForScreenText(/PostgreSQL/i, terminal);
    runtime.printScreen('after storage submenu', terminal);

    terminal.write('\x1b[B');
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/PostgreSQL Connection/i, terminal);
    await runtime.waitForScreenText(/Enter a connection string/i, terminal);
    runtime.printScreen('after pg select', terminal);

    const connection = 'postgresql://user:pass@localhost:5432/e2e';
    terminal.write(connection);
    await runtime.sleep(500);
    const maskedScreen = terminal.serialize().view;
    expect(maskedScreen).not.toContain(connection);
    expect(maskedScreen).toMatch(/\*{20,}/);
    runtime.printScreen('after masked connection', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/Storage backend changed to PostgreSQL/i, terminal);
    runtime.printScreen('after storage save', terminal);
  },
};
