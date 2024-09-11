import type { Integration } from '@kpl/core';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export async function generate() {
  console.log('Generating types...');
  // Add your code here

  dotenv.config();
  const configPath = path.join(process.cwd(), 'src/kpl.config.ts');
  const { config } = await import(configPath);

  const corePath = path.join(process.cwd(), 'node_modules/@kpl/core');

  const importConfig = config.integrations.map((int: Integration) => {
    const name = int.name;
    const importName = int.constructor.name;
    const importStatement = `import { ${importName} } from '../../../${int.name.toLowerCase()}'`;
    const typeFormatName = `${name.substring(0) + name.slice(1).toLowerCase()}Format`;
    const typeFormat = `type ${typeFormatName} = { name: "${name}" };`;
    return { importStatement, typeFormat, typeFormatName, importName, name };
  }) as { importStatement: string; typeFormat: string; typeFormatName: string; name: string; importName: string }[];

  const writePath = path.join(corePath, 'dist', 'generated-types', 'index.d.ts');

  fs.writeFileSync(
    writePath,
    `
    ${importConfig.map(({ importStatement }) => importStatement).join(`\n`)}
    
    export interface IntegrationMap {
   ${importConfig.map(({ name, importName }) => `"${name}": ${importName};`).join(`\n`)}
    }
    `,
  );

  console.log('Types generated successfully.');
}
