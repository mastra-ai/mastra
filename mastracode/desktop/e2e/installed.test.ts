import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { expect, test } from '@playwright/test';

import { runDesktopAcceptance } from './acceptance.js';

const appBundle = process.env.MASTRACODE_DESKTOP_ALPHA_APP ?? '/Applications/MastraCode Desktop Alpha.app';
const executablePath =
  process.env.MASTRACODE_DESKTOP_ALPHA_EXECUTABLE ?? join(appBundle, 'Contents', 'MacOS', basename(appBundle, '.app'));

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

test('verifies the installed MastraCode desktop bundle', async () => {
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', appBundle]);

  const infoPlist = join(appBundle, 'Contents', 'Info.plist');
  const iconFile = execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleIconFile', 'raw', '-o', '-', infoPlist], {
    encoding: 'utf8',
  }).trim();
  const installedIcon = join(appBundle, 'Contents', 'Resources', iconFile);
  const sourceIcon = join(import.meta.dirname, '..', 'build', 'icon.icns');
  expect(await sha256(installedIcon)).toBe(await sha256(sourceIcon));

  const result = await runDesktopAcceptance({
    target: { executablePath, automation: 'cdp' },
    requireAuthenticatedModels: process.env.MASTRACODE_DESKTOP_E2E_REQUIRE_AUTHED_MODELS === '1',
    runLiveChat: process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT === '1',
    liveModel: process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT_MODEL,
  });
  console.log(JSON.stringify(result, null, 2));
});
