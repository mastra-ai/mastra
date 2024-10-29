import dotenv from 'dotenv';
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

import { findFirstDirectory, getPrismaBinPath, getPrismaFilePath } from '../utils.js';

export async function generate(dbUrl: string) {
  await generatePrismaClient(dbUrl);
  await generateTypes();
}

async function generatePrismaClient(dbUrl: string) {
  console.log('Generating Prisma client...');

  const PRISMA_BIN = getPrismaBinPath();

  const PRISMA_SCHEMA = getPrismaFilePath('schema.prisma');

  return execa(`${PRISMA_BIN} generate --schema=${PRISMA_SCHEMA}`, {
    env: {
      ...process.env,
      DB_URL: dbUrl,
    },
    shell: true,
    all: true,
    stdio: 'inherit', // inherit will pipe directly to parent process stdout/stderr
  });
}

async function generateTypes() {
  console.log('Generating types...');

  dotenv.config();
  const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

  const kplDeps = Object.keys(pkgJson.dependencies).filter(k => {
    return k.startsWith(`@mastra`) && !['@mastra/core', '@mastra/cli'].includes(k);
  });

  const possibleCorePath = [
    path.join(process.cwd(), 'node_modules/@mastra/core'),
    path.join(process.cwd(), '..', 'node_modules/@mastra/core'),
    path.join(process.cwd(), '..', '..', 'node_modules/@mastra/core'),
    path.join(process.cwd(), '..', '..', '..', 'node_modules/@mastra/core'),
  ];

  const corePath = findFirstDirectory(possibleCorePath);

  if (!corePath) {
    throw new Error(`Couldn't find core path`);
  }

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
