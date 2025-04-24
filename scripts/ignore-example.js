import { spawn as nodeSpawn } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/ignore-example.js <directory>');
  process.exit(1);
}

/**
 * Promisified version of Node.js spawn function
 *
 * @param {string} command - The command to run
 * @param {string[]} args - List of string arguments
 * @param {import('child_process').SpawnOptions} options - Spawn options
 * @returns {Promise<void>} Promise that resolves with the exit code when the process completes
 */
function spawn(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const childProcess = nodeSpawn(command, args, {
      // stdio: 'inherit',
      ...options,
    });

    childProcess.on('error', error => {
      reject(error);
    });

    let stderr = '';
    childProcess.stderr?.on('data', message => {
      stderr += message;
    });

    childProcess.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr));
      }
    });
  });
}

/**
 * Reads the package.json file and returns all dependencies that use local links.
 * @returns {Object} An object containing all linked dependencies
 */
function findLinkedDependencies(dir, protocol = 'link:') {
  try {
    // Read package.json from current working directory
    const packageJson = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));

    // Initialize an object to store linked dependencies
    const linkedDependencies = {};

    // Check regular dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        if (typeof version === 'string' && version.startsWith(protocol)) {
          linkedDependencies[name] = version;
        }
      }
    }

    // Check dev dependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        if (typeof version === 'string' && version.startsWith(protocol)) {
          linkedDependencies[name] = version;
        }
      }
    }

    // Check peer dependencies
    if (packageJson.peerDependencies) {
      for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
        if (typeof version === 'string' && version.startsWith(protocol)) {
          linkedDependencies[name] = version;
        }
      }
    }

    // Check overrides
    if (packageJson.pnpm?.overrides) {
      for (const [name, version] of Object.entries(packageJson.pnpm.overrides)) {
        if (typeof version === 'string' && version.startsWith(protocol)) {
          linkedDependencies[name] = version;
        }
      }
    }

    return linkedDependencies;
  } catch (error) {
    console.error('Error reading package.json:', error);
    return {};
  }
}
const repoRoot = dirname(join(fileURLToPath(import.meta.url), '..'));

// Example usage
const linkedDeps = Object.keys(findLinkedDependencies(join(process.cwd(), dir)));

console.log('Found linked dependencies:', linkedDeps);

await spawn(`pnpm`, ['install', '-w'], {
  cwd: repoRoot,
  shell: true,
});

let ignored = true;
for (const dep of linkedDeps) {
  try {
    console.log(`Check if ${dep} has changed`);
    await spawn(`pnpm`, ['dlx', 'turbo-ignore', dep], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    console.log(`${dep} did not change`);
  } catch {
    ignored = false;
    console.log(`${dep} has changed`);
  }
}

if (ignored) {
  try {
    await spawn('git', ['diff', 'HEAD^', 'HEAD', '--quiet', '--', join(process.cwd(), dir)], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } catch {
    ignored = false;
  }
}

process.exit(ignored ? 0 : 1);
