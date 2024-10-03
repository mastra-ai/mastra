import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export async function generate() {
  console.log('Generating types...');
  // Add your code here

  dotenv.config();
  const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

  const kplDeps = Object.keys(pkgJson.dependencies).filter(k => {
    return k.startsWith(`@mastra`) && !['@mastra/core', '@mastra/cli'].includes(k);
  });

  const corePath = path.join(process.cwd(), 'node_modules/@mastra/core');

  const importConfigMap = [];
  for (const dep of kplDeps) {
    const Int = await import(path.join(process.cwd(), `node_modules/${dep}/dist/index.js`));
    const IntEntry = Object.keys(Int)[0];

    const inst = new Int[IntEntry]({ config: {} });
    const name = inst.name;
    const importName = inst.constructor.name;
    const importStatement = `import { ${importName} } from '../../../${inst.name.toLowerCase()}'`;
    const typeFormatName = `${name.substring(0) + name.slice(1).toLowerCase()}Format`;
    const typeFormat = `type ${typeFormatName} = { name: "${name}" };`;

    importConfigMap.push({ importStatement, typeFormat, typeFormatName, importName, name });
  }

  const writePath = path.join(corePath, 'dist', 'generated-types', 'index.d.ts');

  fs.writeFileSync(
    writePath,
    `
    ${importConfigMap.map(({ importStatement }) => importStatement).join(`\n`)}

    export interface IntegrationMap {
   ${importConfigMap.map(({ name, importName }) => `"${name}": ${importName};`).join(`\n`)}
    }
    `,
  );

  console.log('Types generated successfully.');
}
