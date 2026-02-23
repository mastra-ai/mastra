// scripts/add-dist-tag.js
import { spawn, execSync } from 'child_process';

const tagName = process.argv[2] || 'alpha';

// Use spawn to avoid ENOBUFS — streams stdout instead of buffering it all at once
function getWorkspacePackages() {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['list', '-r', '--json', '--depth=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];

    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`pnpm list exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error(`Failed to parse pnpm list output: ${err.message}`));
      }
    });
  });
}

const workspacePackages = await getWorkspacePackages();

console.log('workspacePackages', workspacePackages);
workspacePackages.forEach(pkg => {
  if (pkg.name && pkg.version && !pkg.private) {
    const command = `npm dist-tag add ${pkg.name}@${pkg.version} ${tagName}`;

    console.log('Executing command: ', command);
    try {
      execSync(command, { stdio: 'inherit' });
      console.log(`✅ Tagged ${pkg.name}@${pkg.version} with ${tagName}`);
    } catch (error) {
      console.error(`❌ Failed to tag ${pkg.name}:`, error.message);
    }
  }
});
