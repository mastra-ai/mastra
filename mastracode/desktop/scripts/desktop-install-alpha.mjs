import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const packageRoot = new URL('..', import.meta.url);
const releaseRoot = new URL('release/desktop/', packageRoot);
const targetApp = '/Applications/MastraCode Desktop Alpha.app';
const appName = 'MastraCode Desktop Alpha';
const appId = 'ai.mastra.mastracode.desktop.alpha';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status ?? 'unknown'}`);
  }
}

const outputDirectories = process.arch === 'arm64' ? ['mac-arm64'] : ['mac', 'mac-x64'];
const sourceApp = outputDirectories
  .map(directory => fileURLToPath(new URL(`${directory}/${appName}.app`, releaseRoot)))
  .find(existsSync);
if (!sourceApp) {
  throw new Error(`No ${appName}.app bundle found for ${process.arch} under ${fileURLToPath(releaseRoot)}`);
}

if (process.platform === 'darwin') {
  spawnSync('osascript', ['-e', `tell application id "${appId}" to quit`], { stdio: 'ignore' });
  const executable = `${targetApp}/Contents/MacOS/${appName}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const running = spawnSync('pgrep', ['-f', executable], { stdio: 'ignore' }).status === 0;
    if (!running) break;
    if (attempt === 19) throw new Error(`${appName} did not quit before installation`);
    await delay(250);
  }
}

await rm(targetApp, { recursive: true, force: true });
run('ditto', ['--rsrc', '--extattr', sourceApp, targetApp]);

if (process.platform === 'darwin') {
  spawnSync('xattr', ['-dr', 'com.apple.quarantine', targetApp], { stdio: 'ignore' });
  run('codesign', ['--force', '--deep', '--sign', '-', targetApp]);
  run('codesign', ['--verify', '--deep', '--strict', targetApp]);
}

console.log(`Installed ${appName} to ${targetApp}`);
run('open', [targetApp]);
