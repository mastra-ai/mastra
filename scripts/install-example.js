import { spawn as nodeSpawn } from 'child_process';
import { link, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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

    return linkedDependencies;
  } catch (error) {
    console.error('Error reading package.json:', error);
    return {};
  }
}

// Example usage
const linkedDeps = Object.keys(findLinkedDependencies('.'));

console.log('Found linked dependencies:', linkedDeps);

const depsToInstall = new Set(linkedDeps);
for (const dep of linkedDeps) {
  const depDir = dirname(fileURLToPath(import.meta.resolve(`${dep}/package.json`)));
  const depDeps = findLinkedDependencies(depDir, 'workspace:');
  for (const depDep of Object.keys(depDeps)) {
    depsToInstall.add(depDep);
  }
}
await spawn(`pnpm`, ['install', ...[...depsToInstall].map(dep => `--filter ${dep}`)], {
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
