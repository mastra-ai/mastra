import { execa, ExecaError } from 'execa';
import fs, { existsSync, mkdirSync, writeFileSync } from 'fs';
import os, { tmpdir } from 'os';
import path, { join } from 'path';
import { build } from 'esbuild';
import process from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import * as TypeScript from 'typescript';


import fse from 'fs-extra/esm';

import { FileEnvService } from '../services/service.fileEnv.js';
import { copyStarterFile, getFirstExistingFile, getInfraPorts, replaceValuesInFile } from '../utils.js';
import getPackageManager from '../utils/getPackageManager.js';
import { createRequire } from 'module';
import { mkdir, writeFile } from 'fs/promises';

const require = createRequire(import.meta.url)

// Explicitly register ts-node before any imports
import { register } from 'ts-node';
register({
  transpileOnly: true,
  esm: true,
  experimentalResolver: true,
});

// Enable module aliases if tsconfig.json exists
const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
if (existsSync(tsconfigPath)) {
  try {
    require('tsconfig-paths/register');
  } catch (e) {
    console.warn('Warning: Could not load tsconfig paths');
  }
}

// Enable TypeScript's module resolution
import * as tsConfigPaths from 'tsconfig-paths';
import { spawn } from 'child_process';



async function copyUserEnvFileToAdmin(adminPath: string, envFile: string = '.env.development') {
  const sourcePath = path.resolve(process.cwd(), envFile);
  const destinationPath = path.resolve(process.cwd(), adminPath, envFile);

  fse.copy(sourcePath, destinationPath, { overwrite: true }, err => {
    if (err) {
      console.log('An error occurred while trying to copy the .env file from mastra project directory to admin.');
      console.error(err);
    }
  });
}

const objectToEnvString = (envObject: Record<string, any>): string => {
  return Object.entries(envObject)
    .map(([key, value]) => {
      // Ensure the value is stringified and handle special characters if needed
      const stringValue = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `${key}="${stringValue}"`;
    })
    .join('\n');
};

async function copyEnvToAdmin(adminPath: string, envFile: string = '.env.development') {
  const destinationPath = path.resolve(process.cwd(), adminPath, envFile);

  fs.writeFileSync(destinationPath, objectToEnvString(process.env), 'utf-8');
}

async function watchUserEnvAndSyncWithAdminEnv(adminPath: string, envFile: string = '.env.development') {
  const userEnvPath = path.resolve(process.cwd(), envFile);

  try {
    fs.watch(userEnvPath, eventType => {
      if (eventType === 'change') {
        copyUserEnvFileToAdmin(adminPath, envFile);
      }
    });
  } catch (err) {
    console.log('An error occurred while trying to watch the .env file in the mastra project directory.');
    console.error(err);
  }
}

async function addDotMastraToUserGitIgnore() {
  const userGitIgnorePath = path.resolve(process.cwd(), '.gitignore');
  try {
    const gitignoreFileData = fs.readFileSync(userGitIgnorePath, 'utf8');
    const mastraIgnoreStatement = '\n.mastra/\n';
    if (gitignoreFileData.includes(mastraIgnoreStatement)) {
      console.log('.mastra already ignored');
      return false;
    }
    fs.appendFileSync(userGitIgnorePath, `\n# mastra${mastraIgnoreStatement}`);
    console.log('.mastra successfully ignored');
    return true;
  } catch (err) {
    console.log('An error occurred while trying to add .mastra folder to user gitignore');
    console.error(err);
  }
}

async function generateUserDefinedIntegrations({
  adminPath,
  integrationsPath,
}: {
  adminPath: string;
  integrationsPath: string;
}) {
  const buildUserDefinedIntegrationScript = path.resolve(adminPath, 'scripts', 'build-user-defined-integrations.mjs');

  await execa(`node`, [buildUserDefinedIntegrationScript], {
    cwd: adminPath,
    env: {
      ...process.env,
      INTEGRATION_PATH: integrationsPath,
    },
  });
}

const copyFolder = async (src: string, dest: string, excludedFolders?: string[]): Promise<void> => {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }

  fs.mkdirSync(dest, { recursive: true });

  // Resolve the paths to ensure they are absolute
  const resolvedSrc = path.resolve(src);
  const resolvedDest = path.resolve(dest);

  try {
    // Use the `cp` command with the `-r` flag for recursive copying
    await execa('cp', ['-R', '-L', resolvedSrc, resolvedDest]);
    console.log(`Folder copied from ${resolvedSrc} to ${resolvedDest}`);
    // Remove exlcuded folders
    if (excludedFolders?.length) {
      excludedFolders.forEach(folder => {
        const pathToRemove = path.join(resolvedDest, folder);
        if (fs.existsSync(pathToRemove)) {
          fs.rmSync(pathToRemove, { recursive: true });
        }
      });
    }
  } catch (error: any) {
    console.error(`Error copying folder: ${error.message}`);
  }
};

async function listFiles(directory: string) {
  try {
    const { stdout } = await execa('ls', ['-l', directory]);
    console.log(stdout);
  } catch (error) {
    console.error('Error listing files:', error);
  }
}





export async function startServer({
  port: _port,
}: {
  port?: number;
}) {
  console.log('starting server...');

  const cwd = process.cwd();
  const possiblePaths = [
    join(cwd, 'mastra'), // for "mastra" directory
    join(cwd, 'src', 'mastra'), // for source directory
    cwd // if we're already in the mastra directory
  ];

  let frameworkPath: string | undefined;

  for (const path of possiblePaths) {
    const indexPath = join(path, 'index.ts');
    frameworkPath = join(path, 'framework.ts');

    if (existsSync(indexPath)) {
      frameworkPath = indexPath;
      break;
    }
    if (existsSync(frameworkPath)) {
      frameworkPath = frameworkPath;
      break;
    }
  }

  // Create a temporary runner file
  const runnerCode = `
    import { mastra } from '${frameworkPath?.replace('.ts', '.js')}';

    async function run() {
      try {
        console.log(mastra)
        console.log(JSON.stringify({ success: true, result }));
      } catch (error) {
        console.log(JSON.stringify({ success: false, error: error.message }));
      }
    }

    run();
  `

  console.log(runnerCode)

  if (!existsSync(join(cwd, '.mastra'))) {
    mkdirSync(join(cwd, '.mastra'));
  }

  // Write the runner file
  writeFileSync(path.join(cwd, '.mastra', '/server.js'), runnerCode);

  // Create package.json for the temporary directory
  writeFileSync(join(path.join(cwd, '.mastra'), 'package.json'), JSON.stringify({
    "type": "module"
  }));


  // Execute the code using ts-node
  const tsNode = spawn('ts-node', [
    '--esm',
    path.join(cwd, '.mastra', 'server.js')
  ], {
    stdio: ['inherit', 'pipe', 'inherit'],
    env: {
      ...process.env,
      TS_NODE_PROJECT: join(process.cwd(), 'tsconfig.json')
    }
  });

  let output = '';
  tsNode.stdout.on('data', (data) => {
    output += data.toString();
  });

  tsNode.on('close', (code) => {
    if (code === 0 && output) {
      try {
        const result = JSON.parse(output);
        if (result.success) {
          console.log('Result:', result.result);
        } else {
          console.error('Error:', result.error);
          process.exit(1);
        }
      } catch (e) {
        console.log(output);
      }
    } else if (code !== 0) {
      console.error('Failed to execute method');
      process.exit(1);
    }
  });


  // // TODO: fix cwd so it works from project directory, not just from the cli directory
  // const __filename = fileURLToPath(import.meta.url);
  // const __dirname = path.dirname(__filename);

  // const targetDir = process.cwd();

  // // const result = await build({
  // //   entryPoints: [`${targetDir}/src/mastra/index.ts`],
  // //   bundle: true,
  // //   write: false,
  // //   format: 'esm',
  // //   platform: 'node',
  // //   target: 'node16',
  // //   loader: { '.ts': 'ts' },
  // //   packages: 'external', // Keep all packages as external
  // //   external: [
  // //     // '@mastra/*',  // External packages
  // //     'fs',
  // //     'path',
  // //     'http',
  // //     'https',
  // //     'crypto',
  // //     'os',
  // //     'util',
  // //     'stream',
  // //     'zlib',
  // //     'events',
  // //     'node:*'
  // //   ],
  // //   mainFields: ['module', 'main'],
  // //   conditions: ['import', 'node'],
  // //   // alias: {
  // //   //   '@mastra/core': path.join(process.cwd(), 'node_modules/@mastra/core/dist/core.esm.js'),
  // //   // }
  // // });
  // // Write to current directory instead of tmp

  // if (!fs.existsSync(path.join(process.cwd(), `.mastra`))) {
  //   fs.mkdirSync(path.join(process.cwd(), `.mastra`));
  // }

  // const outFile = path.join(process.cwd(), `.mastra/server.ts`);

  // writeFileSync(outFile, `
  //   import { mastra } from '../src/mastra'
  //   mastra.createServer(${port});
  // `);

  // Import using the file path
  // const module = await import(pathToFileURL(outFile).href);
  // console.log(module)

  // const possibleAdminPaths = [path.resolve(__dirname, '..', '..', 'admin', 'next.config.mjs')];

  // // Determine the admin path.
  // let adminPath = getFirstExistingFile(possibleAdminPaths);

  // // Remove the next.config.js file from the admin path
  // adminPath = path.resolve(adminPath, '..');

  // const configPath = path.resolve(process.cwd(), 'mastra.config');


  // copyUserEnvFileToAdmin(adminPath, envFile);

  // watchUserEnvAndSyncWithAdminEnv(adminPath, envFile);

  // const integrationsPath = path.resolve(process.cwd(), 'integrations');

  // if (fs.existsSync(integrationsPath)) {
  //   generateUserDefinedIntegrations({ adminPath, integrationsPath });
  // }

  // console.log('Installing Admin deps...');

  // const packageManager = getPackageManager();

  // await execa(`${packageManager} install`, {
  //   cwd: adminPath,
  //   all: true,
  //   buffer: false,
  //   env: {
  //     ...process.env,
  //     MASTRA_APP_DIR: process.cwd(),
  //   },
  //   shell: true,
  //   stdio: 'inherit', // This will pipe directly to parent process stdout/stderr
  // });

  // // Move prisma client to root node_modules
  // const corePrismaPath = path.resolve(adminPath, 'node_modules', '@mastra', 'core', 'node_modules', '@prisma-app');
  // const rootPrismaPath = path.resolve(adminPath, 'node_modules', '@prisma-app');
  // await copyFolder(corePrismaPath, rootPrismaPath);

  // console.log('Starting Next.js dev server...');

  // let devCommand = `${packageManager} run dev -p ${port}`;

  // if (packageManager === 'npm') {
  //   devCommand = `${packageManager} run dev -- -p ${port}`;
  // }

  // const nextServer = execa(devCommand, {
  //   cwd: adminPath,
  //   all: true,
  //   buffer: false,
  //   env: {
  //     ...process.env,
  //     MASTRA_APP_DIR: process.cwd(),
  //   },
  //   shell: true,
  //   stdio: 'inherit', // This will pipe directly to parent process stdout/stderr
  // });

  // process.on('SIGINT', async () => {
  //   console.log('Stopping Next.js dev server...');
  //   nextServer.kill();
  //   process.exit();
  // });

  // await nextServer;
  // } catch (error: any) {
  //   if (error instanceof ExecaError) {
  //     console.error(error);
  //   }
  //   console.error(`Error: ${error.message}`);
  // }
}
