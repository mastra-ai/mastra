import type { Integration } from '@arkw/core';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export async function generate() {
  console.log('Generating types...');
  // Add your code here

  dotenv.config();
  const configPath = path.join(process.cwd(), 'src/arkw.config.ts');
  const { config } = await import(configPath);

  const corePath = path.join(process.cwd(), 'node_modules/@arkw/core');

  const importConfig = config.integrations.map((int: Integration) => {
    const name = int.name;
    const importName = int.constructor.name;
    const importStatement = `import { ${importName} } from '../../../${int.name.toLowerCase()}'`;
    const typeFormatName = `${name.substring(0) + name.slice(1).toLowerCase()}Format`;
    const typeFormat = `type ${typeFormatName} = { name: "${name}" };`;
    return { importStatement, typeFormat, typeFormatName, importName };
  }) as { importStatement: string; typeFormat: string; typeFormatName: string; importName: string }[];

  const writePath = path.join(corePath, 'dist', 'generated-types', 'index.d.ts');

  fs.writeFileSync(
    writePath,
    `
    import type { Integration } from '../integration'
    ${importConfig.map(({ importStatement }) => importStatement).join(`\n`)}
    \n
    ${importConfig.map(({ typeFormat }) => typeFormat).join(`\n`)}
    
    export type IntegrationFormat = ${importConfig.map(({ typeFormatName }) => typeFormatName).join(` | `)}


    export type IntegrationReturnType<TIntegrationFormat extends IntegrationFormat> =

    ${importConfig
      .map(
        ({ typeFormatName, importName }) =>
          `TIntegrationFormat extends ${typeFormatName} ? ${importName} & Integration :`,
      )
      .join(`\n`)}
    never
    `,
  );

  console.log('Types generated successfully.');
}
