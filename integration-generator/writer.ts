import dotenv from 'dotenv';
import { execa } from 'execa';
import path from 'path';

import { generateFromFile } from './generate';

dotenv.config({
  path: path.join(__dirname, '.env'),
});

async function main() {
  console.log('Generating integrations');

  const args = require('minimist')(process.argv.slice(2)) as Record<string, string>;

  const { name } = await generateFromFile({
    name: args.branch,
    authType: 'API_KEY',
  });

  console.log(`Done generating ${name} integration`);

  // "gen:zod:schema": "pnpx ts-to-zod  src/client/types.gen.ts src/client/zodSchema.ts"

  execa('npx', [
    'ts-to-zod',
    `./packages/${name}/src/client/types.gen.ts`,
    `./packages/${name}/src/client/zodSchema.ts`,
  ]);
}

main().catch(console.error);
