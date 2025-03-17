import { log } from '../utils';
import { prepareCodeExamples } from './code-examples';
import { copyRaw } from './copy-raw';
import { preparePackageChanges } from './package-changes';

export async function prepare() {
  log('Preparing documentation...');
  await copyRaw();
  log('Preparing code examples...');
  await prepareCodeExamples();
  log('Preparing package changelogs...');
  await preparePackageChanges();
  log('Documentation preparation complete!');
}
