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
  let name;

  try {
    const { name: integrationName } = await generateFromFile({
      name: args.branch,
      authType: 'API_KEY',
    });
    name = integrationName;
  } catch (error) {
    console.error(`Error generating integration`);
  }

  console.log(`Done generating ${name} integration`);

  // "gen:zod:schema": "pnpx ts-to-zod  src/client/types.gen.ts src/client/zodSchema.ts"

  try {
    execa('npx', [
      'ts-to-zod',
      `./packages/${name}/src/client/types.gen.ts`,
      `./packages/${name}/src/client/zodSchema.ts`,
    ]);
  } catch (error) {
    console.error(`Error generating zod schema for ${name} integration`);
  }
}

main().catch(console.error);
