import { copyRaw } from './copy-raw';
import { prepareCodeExamples } from './code-examples';
import { preparePackageChanges } from './package-changes';

async function main() {
  console.log('Preparing documentation...');
  
  await copyRaw();
  
  console.log('Preparing code examples...');
  await prepareCodeExamples();
  
  console.log('Preparing package changelogs...');
  await preparePackageChanges();
  
  console.log('Documentation preparation complete!');
}

main().catch(error => {
  console.error('Error preparing documentation:', error);
  process.exit(1);
});
