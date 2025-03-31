import { spawn as nodeSpawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
function findLinkedDependencies() {
  try {
    // Read package.json from current working directory
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

    // Initialize an object to store linked dependencies
    const linkedDependencies = {};

    // Check regular dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        if (typeof version === 'string' && version.startsWith('link:')) {
          linkedDependencies[name] = version;
        }
      }
    }

    // Check dev dependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        if (typeof version === 'string' && version.startsWith('link:')) {
          linkedDependencies[name] = version;
        }
      }
    }

    // Check peer dependencies
    if (packageJson.peerDependencies) {
      for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
        if (typeof version === 'string' && version.startsWith('link:')) {
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

// Example usage
const linkedDeps = Object.keys(findLinkedDependencies());

console.log('Found linked dependencies:', linkedDeps);

await spawn(`pnpm`, ['install', ...linkedDeps.map(dep => `--filter ${dep}`)], {
  cwd: resolve(process.cwd(), '..', '..'),
  shell: true,
  stdio: 'inherit',
});

await spawn(`pnpm`, ['dlx', 'turbo', 'build', ...linkedDeps.map(dep => `--filter ${dep}`)], {
  cwd: resolve(process.cwd(), '..', '..'),
  shell: true,
  stdio: 'inherit',
  env: process.env,
});
