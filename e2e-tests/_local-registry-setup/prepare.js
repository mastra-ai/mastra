import { exec, execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// 10 minutes timeout for changeset operations - CI can be slow
const defaultTimeout = 10 * 60 * 1000;

// Reduced retries since we now properly kill processes on timeout
let maxRetries = 2;

/**
 * Execute a command with proper timeout handling that kills the child process on timeout.
 * This prevents race conditions where timed-out processes continue running.
 */
function execWithTimeout(command, options, timeout) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, {
      cwd: options.cwd,
      shell: true,
      // Use 'ignore' for stdin to prevent interactive prompts from hanging
      // Use 'inherit' for stdout/stderr so we see the output
      stdio: ['ignore', 'inherit', 'inherit'],
      // Create a new process group so we can kill all child processes
      detached: process.platform !== 'win32',
    });

    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Kill the entire process group to ensure all child processes are terminated
      try {
        if (process.platform !== 'win32') {
          process.kill(-child.pid, 'SIGKILL');
        } else {
          child.kill('SIGKILL');
        }
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          // Process may have already exited
        }
      }
      reject(new Error(`Command "${command}" timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', code => {
      clearTimeout(timeoutHandle);
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command}" exited with code ${code}`));
      }
    });

    child.on('error', err => {
      clearTimeout(timeoutHandle);
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function retryWithTimeout(fn, timeout, name, retryCount = 0) {
  return fn().catch(err => {
    console.log(`Command "${name}" failed (attempt ${retryCount + 1}/${maxRetries + 1}): ${err.message}`);
    if (retryCount < maxRetries) {
      return retryWithTimeout(fn, timeout, name, retryCount + 1);
    }
    throw err;
  });
}

function cleanup(monorepoDir, resetChanges = false) {
  execSync('git checkout .', {
    cwd: monorepoDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  execSync('git clean -fd', {
    cwd: monorepoDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });

  if (resetChanges) {
    execSync('git reset --soft HEAD~1', {
      cwd: monorepoDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });
  }
}

/**
 *
 * @param {string} monorepoDir
 * @param {typeof import('globby').globby} glob
 * @param {string} tag
 * @returns
 */
export async function prepareMonorepo(monorepoDir, glob, tag) {
  let shelvedChanges = false;

  console.log('Storing changes into SAVEPOINT.');
  try {
    const gitStatus = await execAsync('git status --porcelain', {
      cwd: monorepoDir,
      encoding: 'utf8',
    });

    if (gitStatus.stdout.length > 0) {
      await execAsync('git add -A', {
        cwd: monorepoDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      });
      await execAsync('git commit -m "SAVEPOINT" --no-verify', {
        cwd: monorepoDir,
        stdio: ['inherit', 'inherit', 'inherit'],
        env: {
          ...process.env,
          HUSKY: '0',
        },
      });
      shelvedChanges = true;
    }

    console.log('Updating workspace dependencies to use * instead of ^');
    await (async function updateWorkspaceDependencies() {
      // Update workspace dependencies to use ^ instead of *
      const packageFiles = await glob('**/package.json', {
        ignore: ['**/node_modules/**', '**/examples/**'],
        cwd: monorepoDir,
      });

      for (const file of packageFiles) {
        const content = readFileSync(join(monorepoDir, file), 'utf8');

        const parsed = JSON.parse(content);
        if (parsed?.peerDependencies?.['@mastra/core']) {
          parsed.peerDependencies['@mastra/core'] = 'workspace:*';
        }

        // convert all workspace dependencies to *
        for (const dependency of Object.keys(parsed.dependencies || {})) {
          if (parsed.dependencies[dependency]?.startsWith('workspace:')) {
            parsed.dependencies[dependency] = 'workspace:*';
          }
        }
        // convert all workspace devDependencies to *
        for (const dependency of Object.keys(parsed.devDependencies || {})) {
          if (parsed.devDependencies[dependency]?.startsWith('workspace:')) {
            parsed.devDependencies[dependency] = 'workspace:*';
          }
        }

        writeFileSync(join(monorepoDir, file), JSON.stringify(parsed, null, 2));
      }
    })();

    // Because it requires a GITHUB_TOKEN
    console.log('Updating .changeset/config.json to not use @changesets/changelog-github');
    await (async function updateChangesetConfig() {
      const content = readFileSync(join(monorepoDir, '.changeset/config.json'), 'utf8');
      const parsed = JSON.parse(content);
      parsed.changelog = '@changesets/cli/changelog';
      writeFileSync(join(monorepoDir, '.changeset/config.json'), JSON.stringify(parsed, null, 2));
    })();

    // Clear existing changesets to speed up version command
    // We only need our test changeset, not the 400+ existing ones
    console.log('Clearing existing changeset files for faster versioning');
    const existingChangesets = await glob('*.md', {
      cwd: join(monorepoDir, '.changeset'),
      ignore: ['README.md'],
    });
    for (const file of existingChangesets) {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(join(monorepoDir, '.changeset', file));
    }

    // update all packages so they are on the snapshot version
    const allPackages = await execAsync('pnpm ls -r --depth -1 --json', {
      cwd: monorepoDir,
    });
    const packages = JSON.parse(allPackages.stdout);
    let changeset = `---\n`;
    for (const pkg of packages) {
      if (pkg.name && !pkg.private) {
        changeset += `"${pkg.name}": patch\n`;
      }
    }
    changeset += `---`;
    writeFileSync(join(monorepoDir, `.changeset/test-${new Date().toISOString()}.md`), changeset);
    // process.exit(0); // Remove this - it prevents changeset commands from running
    console.log('Running pnpm changeset-cli pre exit');
    await retryWithTimeout(
      async () => {
        await execWithTimeout('pnpm changeset-cli pre exit', { cwd: monorepoDir }, defaultTimeout);
      },
      defaultTimeout,
      'pnpm changeset-cli pre exit',
    );

    console.log(`Running pnpm changeset-cli version --snapshot ${tag}`);
    await retryWithTimeout(
      async () => {
        await execWithTimeout(`pnpm changeset-cli version --snapshot ${tag}`, { cwd: monorepoDir }, defaultTimeout);
      },
      defaultTimeout,
      `pnpm changeset-cli version --snapshot ${tag}`,
    );
  } catch (error) {
    cleanup(monorepoDir, false);
    throw error;
  }

  return () => cleanup(monorepoDir, shelvedChanges);
}
