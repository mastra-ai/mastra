import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import yoctoSpinner from 'yocto-spinner';

import type { LLMProvider } from '../commands/init/utils';
import { getModelIdentifier } from '../commands/init/utils';
import { getPackageManager } from '../commands/utils';

import { logger } from './logger';
import type { Template } from './template-utils';

const execFile = util.promisify(child_process.execFile);

export interface CloneTemplateOptions {
  template: Template;
  projectName: string;
  targetDir?: string;
  branch?: string;
  llmProvider?: LLMProvider;
}

export async function cloneTemplate(options: CloneTemplateOptions): Promise<string> {
  const { template, projectName, targetDir, branch, llmProvider } = options;
  const projectPath = targetDir
    ? path.resolve(targetDir, projectName)
    : path.resolve(projectName);

  const spinner = yoctoSpinner({
    text: `Cloning template "${template.title}"...`,
  }).start();

  try {
    if (await directoryExists(projectPath)) {
      spinner.error(`Directory ${projectName} already exists`);
      throw new Error(`Directory ${projectName} already exists`);
    }

    await cloneRepositoryWithoutGit(template.githubUrl, projectPath, branch);

    await updatePackageJson(projectPath, projectName);

    const envExamplePath = path.join(projectPath, '.env.example');
    if (await fileExists(envExamplePath)) {
      const envPath = path.join(projectPath, '.env');
      await fs.copyFile(envExamplePath, envPath);

      if (llmProvider) {
        await updateEnvFile(envPath, llmProvider);
      }
    }

    spinner.success(
      `Template "${template.title}" cloned successfully to ${projectName}`,
    );

    return projectPath;
  } catch (error) {
    spinner.error(
      `Failed to clone template: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
    throw error;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function cloneRepositoryWithoutGit(
  repoUrl: string,
  targetPath: string,
  branch?: string,
): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });

  // 1. Try degit first
  try {
    const repo = repoUrl.replace('https://github.com/', '');
    const repoWithBranch = branch ? `${repo}#${branch}` : repo;

    await execFile('npx', ['degit', repoWithBranch, targetPath], {
      cwd: process.cwd(),
    });

    return;
  } catch {
    // fallback to git
  }

  // 2. Fallback git clone (SAFE VERSION)
  const args: string[] = ['clone'];

  if (branch) {
    args.push('--branch', branch);
  }

  args.push(repoUrl, targetPath);

  await execFile('git', args, {
    cwd: process.cwd(),
  });

  // remove .git
  const gitDir = path.join(targetPath, '.git');
  if (await directoryExists(gitDir)) {
    await fs.rm(gitDir, { recursive: true, force: true });
  }
}

async function updatePackageJson(
  projectPath: string,
  projectName: string,
): Promise<void> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.name = projectName;

    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      'utf-8',
    );
  } catch (error) {
    logger.warn('Could not update package.json', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function updateEnvFile(
  envPath: string,
  llmProvider: LLMProvider,
): Promise<void> {
  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    const modelString = getModelIdentifier(llmProvider);

    if (!modelString) {
      logger.warn('Could not get model identifier', { provider: llmProvider });
      return;
    }

    const modelValue = modelString.replace(/'/g, '');

    const updatedContent = envContent.replace(
      /^MODEL=.*/m,
      `MODEL=${modelValue}`,
    );

    await fs.writeFile(envPath, updatedContent, 'utf-8');

    logger.info('Updated MODEL in .env', { model: modelValue });
  } catch (error) {
    logger.warn('Could not update .env file', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function installDependencies(
  projectPath: string,
  packageManager?: string,
): Promise<void> {
  const spinner = yoctoSpinner({
    text: 'Installing dependencies...',
  }).start();

  try {
    const pm = packageManager || getPackageManager();

    await execFile(pm, ['install'], {
      cwd: projectPath,
    });

    spinner.success('Dependencies installed successfully');
  } catch (error) {
    spinner.error(
      `Failed to install dependencies: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
    throw error;
  }
}
