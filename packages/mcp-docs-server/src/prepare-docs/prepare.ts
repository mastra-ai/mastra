import { env, exit } from 'node:process';
import { log } from '../utils.js';
import { prepareCodeExamples } from './code-examples.js';
import { copyRaw } from './copy-raw.js';
import { preparePackageChanges } from './package-changes.js';

export async function prepare() {
  log('Preparing documentation...');
  await copyRaw();
  log('Preparing code examples...');
  await prepareCodeExamples();
  log('Preparing package changelogs...');
  await preparePackageChanges();
  log('Documentation preparation complete!');
}

if (env.PREPARE === `true`) {
  try {
    await prepare();
  } catch (error) {
    console.error('Error preparing documentation:', error);
    exit(1);
  }
}
