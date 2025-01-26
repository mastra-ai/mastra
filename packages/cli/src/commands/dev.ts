import { bundle, Deployer, FileService } from '@mastra/deployer';
import { ChildProcess } from 'child_process';
import { watch } from 'chokidar';
import { config } from 'dotenv';
import { execa } from 'execa';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentServerProcess: ChildProcess | undefined;
let isRestarting = false;

const bundleTools = async (mastraPath: string, dotMastraPath: string, toolsDirs?: string) => {
  const defaultToolsPath = path.join(mastraPath, 'tools');
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
              fileName: `${fileName}${path.parse(file).ext}`,
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
    await bundle(join(path, fileName), {
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
    logger.info('[Mastra Dev] - Starting server...');

    currentServerProcess = (await execa('node', ['index.mjs'], {
      cwd: dotMastraPath,
      env: {
        PORT: port.toString() || '4111',
        MASTRA_TOOLS_PATH,
      },
      stdio: 'inherit',
      reject: false,
    })) as any as ChildProcess;

    if (!currentServerProcess) {
      throw new Error(`Server failed to start with error: ${currentServerProcess.stderr}`);
    }

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
      logger.error('Server failed to start with error:', { message: currentServerProcess.stderr });
      return;
    }
  } catch (err) {
    const execaError = err as { stderr?: string; stdout?: string };
    if (execaError.stderr) logger.error('Server error output:', { stderr: execaError.stderr });
    if (execaError.stdout) logger.debug('Server output:', { stdout: execaError.stdout });
  }
};

async function rebundleAndRestart(
  dir: string,
  mastraPath: string,
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
      logger.debug('Stopping current server...');
      currentServerProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    config({ path: envFile });

    const deployer = new Deployer({
      dir,
      type: 'Dev',
    });

    /*
      Bundle mastra
    */

    await deployer.prepare({
      dir: mastraPath,
      playground: true,

      useBanner: false,
    });

    /*
      Bundle tools
    */
    const MASTRA_TOOLS_PATH = await bundleTools(mastraPath, dotMastraPath, toolsDirs);

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
  const dirSelected = dir || process.cwd();

  const deployer = new Deployer({
    dir: dirSelected,
    type: 'Dev',
  });

  const dotMastraPath = deployer.getMastraPath();

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

  const mastraDir = join(dirSelected, 'src/mastra');
  /*
    Bundle mastra
  */
  await deployer.prepare({
    dir: join(dirSelected, 'src/mastra'),
    playground: true,
    useBanner: false,
  });

  const envPaths = [path.join(dirSelected, '.env'), path.join(dirSelected, '.env.development')];
  /*
    Bundle tools
  */
  const MASTRA_TOOLS_PATH = await bundleTools(mastraDir, dotMastraPath, toolsDirs);

  writeFileSync(join(dotMastraPath, 'index.mjs'), readFileSync(join(__dirname, '../templates/dev.entry.js'), 'utf8'));

  writeFileSync(join(dotMastraPath, 'evals.json'), ``);

  await startServer(dotMastraPath, port, MASTRA_TOOLS_PATH);

  const watcher = watch([mastraDir, ...envPaths], {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', async () => {
    console.log(`Changes detected, rebundling and restarting server...`);
    await rebundleAndRestart(dirSelected, mastraDir, dotMastraPath, port, envFile, toolsDirs);
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
