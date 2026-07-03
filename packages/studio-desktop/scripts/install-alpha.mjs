import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const releaseDir = join(packageRoot, 'release');
const sourceCandidates = [
  join(releaseDir, `mac-${process.arch}`, 'Mastra Studio.app'),
  join(releaseDir, 'mac-arm64', 'Mastra Studio.app'),
  join(releaseDir, 'mac', 'Mastra Studio.app'),
];
const sourceApp = sourceCandidates.find(candidate => existsSync(candidate));

const installDir = process.env.MASTRA_DESKTOP_ALPHA_INSTALL_DIR || '/Applications';
const alphaName = process.env.MASTRA_DESKTOP_ALPHA_APP_NAME || 'Mastra Studio Alpha';
const targetApp = join(installDir, `${alphaName}.app`);

function run(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, { stdio: optional ? 'ignore' : 'inherit' });
  if (result.error) {
    if (optional) return;
    throw result.error;
  }
  if ((result.status ?? 1) !== 0 && !optional) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function setPlistValue(plistPath, key, value) {
  run('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath]);
}

if (!sourceApp) {
  throw new Error('Mastra Studio.app was not found. Run `pnpm --filter @internal/studio-desktop package` first.');
}

rmSync(targetApp, { recursive: true, force: true });
run('ditto', ['--rsrc', '--extattr', sourceApp, targetApp]);

const plistPath = join(targetApp, 'Contents', 'Info.plist');
setPlistValue(plistPath, 'CFBundleDisplayName', alphaName);
setPlistValue(plistPath, 'CFBundleName', 'Mastra Studio');
setPlistValue(plistPath, 'CFBundleIdentifier', 'ai.mastra.studio.desktop.alpha');

run('xattr', ['-dr', 'com.apple.quarantine', targetApp], { optional: true });
run('codesign', ['--force', '--deep', '--sign', '-', targetApp]);

console.log(targetApp);
