import child_process from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import * as p from '@clack/prompts';
import color from 'picocolors';
import prettier from 'prettier';

import { DepsService } from '../../services/service.deps.js';
import { getPackageManagerAddCommand } from '../../utils/package-manager.js';
import type { PackageManager } from '../../utils/package-manager.js';
import { interactivePrompt } from '../init/utils.js';
import type { LLMProvider } from '../init/utils.js';
import { getPackageManager } from '../utils.js';

const exec = util.promisify(child_process.exec);

const execWithTimeout = async (command: string, timeoutMs?: number) => {
  try {
    const promise = exec(command, { killSignal: 'SIGTERM' });

    if (!timeoutMs) {
      return await promise;
    }

    let timeoutId: NodeJS.Timeout;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Command timed out')), timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeout]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      if (error instanceof Error && error.message === 'Command timed out') {
        throw new Error('Something went wrong during installation, please try again.');
      }
      throw error;
    }
  } catch (error: unknown) {
    throw error;
  }
};

async function getInitCommand(pm: PackageManager): Promise<string> {
  switch (pm) {
    case 'npm':
      return 'npm init -y';
    case 'pnpm':
      return 'pnpm init';
    case 'yarn':
      return 'yarn init -y';
    case 'bun':
      return 'bun init -y';
    default:
      return 'npm init -y';
  }
}

async function initializePackageJson(pm: PackageManager): Promise<void> {
  // Run the init command
  const initCommand = await getInitCommand(pm);
  await exec(initCommand);

  // Read and update package.json directly (more reliable than pkg set)
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

  packageJson.type = 'module';
  packageJson.engines = {
    ...packageJson.engines,
    node: '>=22.13.0',
  };

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

const writeReadmeFile = async ({ dirPath, projectName }: { dirPath: string; projectName: string }) => {
  const packageManager = getPackageManager();
  const readmePath = path.join(dirPath, 'README.md');

  const content = `# ${projectName}

Welcome to your new [Mastra](https://mastra.ai/) project! We're excited to see what you'll build.

## Getting Started

Start the development server:

\`\`\`shell
${packageManager} run dev
\`\`\`

Open [http://localhost:4111](http://localhost:4111) in your browser to access [Mastra Studio](https://mastra.ai/docs/v1/getting-started/studio). It provides an interactive UI for building and testing your agents, along with a REST API that exposes your Mastra application as a local service. This lets you start building without worrying about integration right away.

You can start editing files inside the \`src/mastra\` directory. The development server will automatically reload whenever you make changes.

## Learn more

To learn more about Mastra, visit our [documentation](https://mastra.ai/docs/v1/). Your bootstrapped project includes example code for [agents](https://mastra.ai/docs/v1/agents/overview), [tools](https://mastra.ai/docs/v1/agents/using-tools), [workflows](https://mastra.ai/docs/v1/workflows/overview), [scorers](https://mastra.ai/docs/v1/evals/overview), and [observability](https://mastra.ai/docs/v1/observability/overview).

If you're new to AI agents, check out our [course](https://mastra.ai/course) and [YouTube videos](https://youtube.com/@mastra-ai). You can also join our [Discord](https://discord.gg/BTYqqHKUrf) community to get help and share your projects.

## Deploy on Mastra Cloud

[Mastra Cloud](https://cloud.mastra.ai/) gives you a serverless agent environment with atomic deployments. Access your agents from anywhere and monitor performance. Make sure they don't go off the rails with evals and tracing.

Check out the [deployment guide](https://mastra.ai/docs/v1/deployment/overview) for more details.`;

  const formattedContent = await prettier.format(content, {
    parser: 'markdown',
    singleQuote: true,
  });

  await fs.writeFile(readmePath, formattedContent);
};

async function installMastraDependency(
  pm: PackageManager,
  dependency: string,
  versionTag: string,
  isDev: boolean,
  timeout?: number,
) {
  let installCommand = getPackageManagerAddCommand(pm);

  if (isDev) {
    /**
     * All our package managers support -D for devDependencies. We can't use --save-dev across the board because yarn and bun don't alias it.
     * npm: -D, --save-dev. pnpm: -D, --save-dev. yarn: -D, --dev. bun: -D, --dev
     */
    installCommand = `${installCommand} -D`;
  }

  try {
    await execWithTimeout(`${pm} ${installCommand} ${dependency}${versionTag}`, timeout);
  } catch (err) {
    if (versionTag === '@latest') {
      throw new Error(
        `Failed to install ${dependency}@latest: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
    try {
      await execWithTimeout(`${pm} ${installCommand} ${dependency}@latest`, timeout);
    } catch (fallbackErr) {
      throw new Error(
        `Failed to install ${dependency} (tried ${versionTag} and @latest): ${fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'}`,
      );
    }
  }
}

export const createMastraProject = async ({
  projectName: name,
  createVersionTag,
  timeout,
  llmProvider,
  llmApiKey,
  needsInteractive,
}: {
  projectName?: string;
  createVersionTag?: string;
  timeout?: number;
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  needsInteractive?: boolean;
}) => {
  p.intro(color.inverse(' Mastra Create '));

  const projectName =
    name ??
    (await p.text({
      message: 'What do you want to name your project?',
      placeholder: 'my-mastra-app',
      defaultValue: 'my-mastra-app',
      validate: value => {
        if (value.length === 0) return 'Project name cannot be empty';
        if (fsSync.existsSync(value)) {
          return `A directory named "${value}" already exists. Please choose a different name.`;
        }
      },
    }));

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  let result: Awaited<ReturnType<typeof interactivePrompt>> | undefined = undefined;

  if (needsInteractive) {
    result = await interactivePrompt({
      options: { showBanner: false },
      skip: { llmProvider: llmProvider !== undefined, llmApiKey: llmApiKey !== undefined },
    });
  }
  const s = p.spinner();
  const originalCwd = process.cwd();
  let projectPath: string | null = null;

  try {
    s.start('Creating project');
    try {
      await fs.mkdir(projectName);
      projectPath = path.resolve(originalCwd, projectName);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        s.stop(`A directory named "${projectName}" already exists. Please choose a different name.`);
        process.exit(1);
      }
      throw new Error(
        `Failed to create project directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    process.chdir(projectName);
    const pm = getPackageManager();
    const installCommand = getPackageManagerAddCommand(pm);

    s.message('Initializing project structure');
    try {
      await initializePackageJson(pm);
      const depsService = new DepsService();
      await depsService.addScriptsToPackageJson({
        dev: 'mastra dev',
        build: 'mastra build',
        start: 'mastra start',
      });
      await writeReadmeFile({ dirPath: process.cwd(), projectName });
    } catch (error) {
      throw new Error(
        `Failed to initialize project structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    s.stop('Project structure created');

    s.start(`Installing ${pm} dependencies`);
    try {
      await exec(`${pm} ${installCommand} zod@^4`);
      await exec(`${pm} ${installCommand} -D typescript @types/node`);
      await exec(`echo '{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": [
    "src/**/*"
  ]
}' > tsconfig.json`);
    } catch (error) {
      throw new Error(
        `Failed to install basic dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    s.stop(`${pm} dependencies installed`);

    s.start('Installing Mastra CLI');
    const versionTag = createVersionTag ? `@${createVersionTag}` : '@latest';

    try {
      await installMastraDependency(pm, 'mastra', versionTag, true, timeout);
    } catch (error) {
      throw new Error(`Failed to install Mastra CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    s.stop('Mastra CLI installed');

    s.start('Installing Mastra dependencies');
    try {
      await installMastraDependency(pm, '@mastra/core', versionTag, false, timeout);
      await installMastraDependency(pm, '@mastra/libsql', versionTag, false, timeout);
      await installMastraDependency(pm, '@mastra/memory', versionTag, false, timeout);
    } catch (error) {
      throw new Error(
        `Failed to install Mastra dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
    s.stop('Mastra dependencies installed');

    s.start('Adding .gitignore');
    try {
      await exec(`echo output.txt >> .gitignore`);
      await exec(`echo node_modules >> .gitignore`);
      await exec(`echo dist >> .gitignore`);
      await exec(`echo .mastra >> .gitignore`);
      await exec(`echo .env.development >> .gitignore`);
      await exec(`echo .env >> .gitignore`);
      await exec(`echo *.db >> .gitignore`);
      await exec(`echo *.db-* >> .gitignore`);
    } catch (error) {
      throw new Error(`Failed to create .gitignore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    s.stop('.gitignore added');

    p.outro('Project created successfully');
    console.info('');

    return { projectName, result };
  } catch (error) {
    s.stop();

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    p.cancel(`Project creation failed: ${errorMessage}`);

    // Clean up: remove the created directory on failure
    if (projectPath && fsSync.existsSync(projectPath)) {
      try {
        // Change back to original directory before cleanup
        process.chdir(originalCwd);
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        // Log but don't throw - we want to exit with the original error
        console.error(
          `Warning: Failed to clean up project directory: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
        );
      }
    }

    process.exit(1);
  }
};
