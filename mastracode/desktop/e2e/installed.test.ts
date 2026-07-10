import { basename, join } from 'node:path';

import { test } from '@playwright/test';

import { runDesktopAcceptance } from './acceptance.js';

const appBundle = process.env.MASTRACODE_DESKTOP_ALPHA_APP ?? '/Applications/MastraCode Desktop Alpha.app';
const executablePath =
  process.env.MASTRACODE_DESKTOP_ALPHA_EXECUTABLE ?? join(appBundle, 'Contents', 'MacOS', basename(appBundle, '.app'));
test('verifies the installed MastraCode desktop bundle', async () => {
  const result = await runDesktopAcceptance({
    target: { executablePath, automation: 'cdp' },
    requireAuthenticatedModels: process.env.MASTRACODE_DESKTOP_E2E_REQUIRE_AUTHED_MODELS === '1',
    runLiveChat: process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT === '1',
    liveModel: process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT_MODEL,
  });
  console.log(JSON.stringify(result, null, 2));
});
