import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/* 
script to install all dependencies for the cli package in package root
*/

if (process.env.NODE_ENV === 'production') {
  console.log('Skipping postinstall in production environment');
  process.exit(0);
}

// Prevent recursive execution
if (process.env.PREVENT_POSTINSTALL_RECURSION) {
  console.log('Skipping recursive postinstall');
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

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

try {
  const packageManager = detectPackageManager();
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
