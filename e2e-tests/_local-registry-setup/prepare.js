import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command.split(' ')[0], command.split(' ').slice(1), {
      shell: true,
      stdio: ['inherit', 'inherit', 'pipe'],
      ...options,
    });

    let output = '';
    if (child.stdout) {
      child.stdout.on('data', data => {
        output += data.toString();
      });
    }

    let errorOutput = '';
    if (child.stderr) {
      child.stderr.on('data', data => {
        errorOutput += data.toString();
      });
    }

    child.on('close', code => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
      }
    });

    child.on('error', err => {
      reject(err);
    });
  });
}

async function cleanup(monorepoDir, resetChanges = false) {
  await runCommand('git checkout .', { cwd: monorepoDir });
  await runCommand('git clean -fd', { cwd: monorepoDir });

  if (resetChanges) {
    await runCommand('git reset --soft HEAD~1', { cwd: monorepoDir });
  }
}

/**
 *
 * @param {string} storageDirectory
 * @param {number} port
 * @returns
 */
export async function prepareMonorepo(monorepoDir, glob) {
  let shelvedChanges = false;

  try {
    const gitStatus = await runCommand('git status --porcelain', {
      cwd: monorepoDir,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    if (gitStatus.length > 0) {
      await runCommand('git add -A', { cwd: monorepoDir, stdio: ['inherit', 'inherit', 'inherit'] });
      await runCommand('git commit -m "SAVEPOINT"', { cwd: monorepoDir, stdio: ['inherit', 'inherit', 'inherit'] });
      shelvedChanges = true;
    }

    await (async function updateWorkspaceDependencies() {
      // Update workspace dependencies to use ^ instead of *
      const packageFiles = await glob('**/package.json', {
        ignore: ['**/node_modules/**', '**/examples/**'],
        cwd: monorepoDir,
      });

      for (const file of packageFiles) {
        const content = readFileSync(join(monorepoDir, file), 'utf8');
        const updated = content.replace(/"workspace:\^"/g, '"workspace:*"');

        const parsed = JSON.parse(content);
        if (parsed?.peerDependencies?.['@mastra/core']) {
          parsed.peerDependencies['@mastra/core'] = '*';
        }

        writeFileSync(join(monorepoDir, file), JSON.stringify(parsed, null, 2));
      }
    })();

    await runCommand('pnpm changeset pre exit', { cwd: monorepoDir });
    await runCommand('pnpm changeset version --snapshot create-mastra-e2e-test', { cwd: monorepoDir });
  } catch (error) {
    await cleanup(monorepoDir, false);
    throw error;
  }

  return () => cleanup(monorepoDir, shelvedChanges);
}
