import { ChildProcess } from 'child_process';
import { watch } from 'chokidar';
import { config } from 'dotenv';
import { execa } from 'execa';
import { writeFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { FileService } from '../services/service.file.js';
import { bundle, bundleServer } from '../utils/bundle.js';

import { EXPRESS_SERVER } from './deploy/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentServerProcess: ChildProcess | undefined;
let isRestarting = false;

const bundleMastra = async (dirPath: string) => {
  await bundle(dirPath, { buildName: 'Mastra' });
};

const bundleTools = async (dirPath: string, dotMastraPath: string, toolsDirs?: string) => {
  const defaultToolsPath = path.join(dirPath, 'tools');
  const toolsPaths = [...(toolsDirs?.split(',').map(tool => path.join(process.cwd(), tool)) || []), defaultToolsPath];

  const toolPathsWithFileNames = (
    await Promise.all(
      toolsPaths.map(async toolPath => {
        try {
          const files = await fs.readdir(toolPath);
          return files.map(file => {
            const fullPath = path.join(toolPath, file);
            const fileName = path.parse(file).name;
            const name = fileName === 'index' ? path.basename(path.dirname(fullPath)) : fileName;
            return {
              path: toolPath,
              name,
              fileName,
            };
          });
        } catch (err) {
          if (toolPath === defaultToolsPath) {
            return [];
          }
          console.warn(`Error reading tools directory ${toolPath}:`, err);
          return [];
        }
      }),
    )
  ).flat();

  for (const { path, name, fileName } of toolPathsWithFileNames) {
    await bundle(path, {
      outfile: join(dotMastraPath, 'tools', `${name}.mjs`),
      entryFile: fileName,
      buildName: `${name}`,
    });
  }

  const MASTRA_TOOLS_PATH = toolPathsWithFileNames?.length
    ? toolPathsWithFileNames.map(tool => path.join(dotMastraPath, 'tools', `${tool.name}.mjs`)).join(',')
    : undefined;

  return MASTRA_TOOLS_PATH;
};

const startServer = async (dotMastraPath: string, port: number, MASTRA_TOOLS_PATH: string) => {
  try {
    // Restart server
    console.log('Starting server...');
    currentServerProcess = execa('node', ['server.mjs'], {
      cwd: dotMastraPath,
      env: {
        PORT: port.toString() || '4111',
        MASTRA_TOOLS_PATH,
      },
      stdio: 'inherit',
      reject: false,
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send refresh signal
    try {
      await fetch(`http://localhost:${port}/__refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      // Retry after another second
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        await fetch(`http://localhost:${port}/__refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (retryErr) {
        // Ignore retry errors
      }
    }

    if (currentServerProcess.exitCode !== null) {
      console.error('Server failed to start with error:', currentServerProcess.stderr);
      return;
    }
  } catch (err) {
    const execaError = err as { stderr?: string; stdout?: string };
    if (execaError.stderr) console.error('Server error output:', execaError.stderr);
    if (execaError.stdout) console.error('Server output:', execaError.stdout);
  }
};

async function rebundleAndRestart(
  dirPath: string,
  dotMastraPath: string,
  port: number,
  envFile: string,
  toolsDirs?: string,
) {
  if (isRestarting) {
    return;
  }

  isRestarting = true;
  try {
    // If current server process is running, stop it
    if (currentServerProcess) {
      console.log('Stopping current server...');
      currentServerProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    config({ path: envFile });

    /*
      Bundle mastra
    */
    await bundleMastra(dirPath);

    /*
      Bundle tools
    */
    const MASTRA_TOOLS_PATH = await bundleTools(dirPath, dotMastraPath, toolsDirs);

    /*
      Bundle server
    */
    writeFileSync(join(dotMastraPath, 'index.mjs'), EXPRESS_SERVER);
    await bundleServer(join(dotMastraPath, 'index.mjs'));

    /*
      Start server
    */
    await startServer(dotMastraPath, port, MASTRA_TOOLS_PATH);
  } finally {
    isRestarting = false;
  }
}

export async function dev({
  port,
  env,
  dir,
  toolsDirs,
}: {
  dir?: string;
  port: number;
  env: Record<string, any>;
  toolsDirs?: string;
}) {
  const dotMastraPath = join(process.cwd(), '.mastra');
  const playgroundServePath = join(dotMastraPath, 'playground');
  const key = env[0]?.name;
  const value = env[0]?.value;

  let envFile = '';

  /*
    Copy playground dist files
  */
  await fsExtra.copy(join(path.dirname(path.dirname(__dirname)), 'src/playground/dist'), playgroundServePath, {
    overwrite: true,
  });

  /*
    Load env
  */
  try {
    const fileService = new FileService();
    envFile = fileService.getFirstExistingFile(['.env.development', '.env']);
    config({ path: envFile });
  } catch (err) {
    //create .env file
    await fsExtra.ensureFile('.env');
    await fs.writeFile(path.join(process.cwd(), '.env'), `${key}=${value}`);
  }

  /*
    Bundle mastra
  */
  const dirPath = dir || path.join(process.cwd(), 'src/mastra');
  const envPaths = [path.join(process.cwd(), '.env'), path.join(process.cwd(), '.env.development')];
  await bundleMastra(dirPath);

  /*
    Bundle tools
  */
  const MASTRA_TOOLS_PATH = await bundleTools(dirPath, dotMastraPath, toolsDirs);

  /*
    Bundle server
  */
  writeFileSync(join(dotMastraPath, 'index.mjs'), EXPRESS_SERVER);
  await bundleServer(join(dotMastraPath, 'index.mjs'));

  await startServer(dotMastraPath, port, MASTRA_TOOLS_PATH);

  const watcher = watch([dirPath, ...envPaths], {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', async () => {
    console.log(`Changes detected, rebundling and restarting server...`);
    await rebundleAndRestart(dirPath, dotMastraPath, port, envFile, toolsDirs);
  });

  process.on('SIGINT', () => {
    console.log('Stopping server...');
    if (currentServerProcess) {
      currentServerProcess.kill();
    }
    watcher.close();
    process.exit(0);
  });
}
