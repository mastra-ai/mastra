import { setupTestProject } from './prepare.js';
import setupVerdaccio from './setup.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function setup() {
  const fixturePath = await mkdtemp(join(tmpdir(), 'mastra-kitchen-sink-test'));
  const projectPath = join(fixturePath, 'project');

  const { shutdown, registryUrl } = await setupVerdaccio();

  await setupTestProject(projectPath, registryUrl);
  await ping();

  shutdown();
}

const ping = async () => {
  let counter = 0;

  return new Promise((resolve, reject) => {
    const intervalId = setInterval(() => {
      fetch('http://localhost:4111')
        .then(res => {
          if (res.ok) {
            clearInterval(intervalId);
            resolve(undefined);
          } else if (counter > 10) {
            clearInterval(intervalId);
            reject(new Error(`Failed after ${counter} attempts`));
          }
        })
        .catch(() => {
          if (counter > 10) {
            clearInterval(intervalId);
            reject(new Error(`Failed after ${counter} attempts`));
          }
        });

      counter++;
    }, 10000);
  });
};

export default setup;
