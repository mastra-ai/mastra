// scripts/add-dist-tag.js
import { execSync } from 'child_process';

const tagName = process.argv[2] || 'alpha';
// Get all packages from pnpm workspace
const workspacePackages = JSON.parse(execSync('pnpm list -r --json --depth=0', { encoding: 'utf8' }));

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
