import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');

// Check if we're in a workspace by looking for pnpm-workspace.yaml
const isWorkspace = fs.existsSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'));

if (isWorkspace || process.env.CI || process.env.NODE_ENV === 'production') {
  console.log('Skipping postinstall in mastra workspace/CI/production environment');
  process.exit(0);
}

// Prevent recursive execution
if (process.env.PREVENT_POSTINSTALL_RECURSION) {
  console.log('Skipping recursive postinstall');
  process.exit(0);
}

function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent || '';
  const execPath = process.env.npm_execpath || '';

  // Check user agent first
  if (userAgent.includes('yarn')) {
    return 'yarn';
  }
  if (userAgent.includes('pnpm')) {
    return 'pnpm';
  }
  if (userAgent.includes('npm')) {
    return 'npm';
  }

  // Fallback to execpath check
  if (execPath.includes('yarn')) {
    return 'yarn';
  }
  if (execPath.includes('pnpm')) {
    return 'pnpm';
  }
  if (execPath.includes('npm')) {
    return 'npm';
  }

  return 'npm'; // Default fallback
}

const packageManager = detectPackageManager();

// Skip postinstall for npm and yarn
if (packageManager !== 'pnpm') {
  process.exit(0);
}

try {
  const installCmd = {
    npm: 'npm install',
    yarn: 'yarn install',
    pnpm: 'pnpm install --shamefully-hoist --filter . --force --silent',
  }[packageManager];

  console.log(`Detected package manager: ${packageManager}`);
  console.log(`Running ${installCmd} in ${packageRoot}`);

  execSync(installCmd, {
    cwd: packageRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PREVENT_POSTINSTALL_RECURSION: 'true',
      PNPM_RECURSIVE_INSTALL_FORCE: 'true',
      PNPM_NO_WARN_HEADLESS: '1',
    },
  });
} catch (error) {
  console.error('Failed to run install:', error);
  process.exit(1);
}
