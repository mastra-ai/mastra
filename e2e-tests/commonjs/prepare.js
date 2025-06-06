import { spawnSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export async function setupTestProject(pathToStoreFiles) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const projectPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  await mkdir(newPath, { recursive: true });
  await cp(projectPath, newPath, { recursive: true });

  console.log('Installing dependencies...');
  await runCommand('pnpm', ['install'], {
    cwd: newPath,
  });
}
