import dotenv from 'dotenv';
import path from 'path';

import { generate } from './generate';
import { sources } from './source';

dotenv.config({
  path: path.join(__dirname, '.env'),
});

async function main() {
  console.log('Generating integrations');
  for (const source of sources) {
    if (['admin', 'cli', 'core', 'google', 'rewatch', 'slack', 'twitter-v2'].includes(source.name)) {
      console.log(`Skipping ${source.name} because it is a reserved name`);
      continue;
    }
    console.log(source);
    await generate(source);
  }

  console.log('Done');
}

main().catch(console.error);
