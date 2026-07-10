import { resolve } from 'node:path';

import { test } from '@playwright/test';

import { resolveDevelopmentElectronExecutable, runDesktopAcceptance } from './acceptance.js';

test('launches the desktop app and opens a project through the typed native bridge', async () => {
  await runDesktopAcceptance({
    target: {
      executablePath: resolveDevelopmentElectronExecutable(),
      args: [resolve('dist/main/main.js')],
      webUiDist: resolve('dist/web-ui'),
    },
    requireAuthenticatedModels: process.env.MASTRACODE_DESKTOP_E2E_REQUIRE_AUTHED_MODELS === '1',
    runLiveChat: process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT === '1',
    liveModel: process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT_MODEL,
  });
});
