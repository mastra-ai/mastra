import { setupTestProject } from './prepare.js';
import setupVerdaccio from './setup.js';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

async function setup() {
  const fixturePath = await mkdtemp(join(tmpdir(), 'mastra-kitchen-sink-test-'));
  const projectPath = join(fixturePath, 'project');

  const stopVerdaccio = await setupVerdaccio();
  await setupTestProject(projectPath);
  await ping();

  stopVerdaccio();
}

const ping = async () => {
  let counter = 0;

  return new Promise((resolve, reject) => {
    const intervalId = setInterval(() => {
      fetch('http://localhost:4111')
        .then(res => {
          if (res.ok) {
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
    }, 1000);
  });
};

export default setup;
