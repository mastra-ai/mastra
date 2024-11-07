import dotenv from 'dotenv';
import path from 'path';

import { generateFromFile } from './generate';

dotenv.config({
  path: path.join(__dirname, '.env'),
});

async function main() {
  console.log('Generating integrations');

  const args = require('minimist')(process.argv.slice(2)) as Record<string, string>;

  await generateFromFile({
    name: args.branch,
    authType: 'API_KEY',
  });

  console.log('Done');
}

main().catch(console.error);
