import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import shellQuote from 'shell-quote';
import yoctoSpinner from 'yocto-spinner';

import type { LLMProvider } from '../commands/init/utils';
import { getModelIdentifier } from '../commands/init/utils';
import { getPackageManager } from '../commands/utils';

import { logger } from './logger';
import type { Template } from './template-utils';

const exec = util.promisify(child_process.exec);

export interface CloneTemplateOptions {
  template: Template;
  projectName: string;
  targetDir?: string;
  branch?: string;
  llmProvider?: LLMProvider;
}

export async function cloneTemplate(options: CloneTemplateOptions): Promise<string> {
  const { template, projectName, targetDir, branch, llmProvider } = options;
  const projectPath = targetDir ? path.resolve(targetDir, projectName) : path.resolve(projectName);

  const spinner = yoctoSpinner({ text: `Cloning template "${template.title}"...` }).start();

  try {
    // Check if directory already exists
    if (await directoryExists(projectPath)) {
      spinner.error(`Directory ${projectName} already exists`);
      throw new Error(`Directory ${projectName} already exists`);
    }

    // Clone the repository without git history
    await cloneRepositoryWithoutGit(template.githubUrl, projectPath, branch);

    // Update package.json with new project name
    await updatePackageJson(projectPath, projectName);

    // Copy .env.example to .env if it exists, and update MODEL if llmProvider is specified
    const envExamplePath = path.join(projectPath, '.env.example');
    if (await fileExists(envExamplePath)) {
      const envPath = path.join(projectPath, '.env');
      await fs.copyFile(envExamplePath, envPath);

      // Update MODEL in .env if llmProvider is specified
      if (llmProvider) {
        await updateEnvFile(envPath, llmProvider);
      }
    }

    spinner.success(`Template "${template.title}" cloned successfully to ${projectName}`);
    return projectPath;
  } catch (error) {
    spinner.error(`Failed to clone template: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

async function cloneRepositoryWithoutGit(repoUrl: string, targetPath: string, branch?: string): Promise<void> {
  // Create target directory
  await fs.mkdir(targetPath, { recursive: true });

  try {
    // First try using degit if available (similar to Next.js)
    const degitRepo = repoUrl.replace('https://github.com/', '');
    // If branch is specified, append it to the degit repo (format: owner/repo#branch)
    const degitRepoWithBranch = branch ? `${degitRepo}#${branch}` : degitRepo;
    const degitCommand = shellQuote.quote(['npx', 'degit', degitRepoWithBranch, targetPath]);
    await exec(degitCommand, {
      cwd: process.cwd(),
    });
  } catch {
    // Fallback to git clone + remove .git
    try {
      const gitArgs = ['git', 'clone'];
      // Add branch flag if specified
      if (branch) {
        gitArgs.push('--branch', branch);
      }
      gitArgs.push(repoUrl, targetPath);

      const gitCommand = shellQuote.quote(gitArgs);
      await exec(gitCommand, {
        cwd: process.cwd(),
      });

      // Remove .git directory
      const gitDir = path.join(targetPath, '.git');
      if (await directoryExists(gitDir)) {
        await fs.rm(gitDir, { recursive: true, force: true });
      }
    } catch (gitError) {
      throw new Error(`Failed to clone repository: ${gitError instanceof Error ? gitError.message : 'Unknown error'}`);
    }
  }
}

async function updatePackageJson(projectPath: string, projectName: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    // Update the name field
    packageJson.name = projectName;

    // Write back the updated package.json
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
  } catch (error) {
    // It's okay if package.json doesn't exist or can't be updated
    logger.warn(`Could not update package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function updateEnvFile(envPath: string, llmProvider: LLMProvider): Promise<void> {
  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    const modelString = getModelIdentifier(llmProvider);

    if (!modelString) {
      logger.warn(`Could not get model identifier for provider: ${llmProvider}`);
      return;
    }

    // Remove quotes from modelString (it comes as 'provider/model')
    const modelValue = modelString.replace(/'/g, '');

    // Replace the MODEL line with the selected provider's model
    const updatedContent = envContent.replace(/^MODEL=.*/m, `MODEL=${modelValue}`);

    await fs.writeFile(envPath, updatedContent, 'utf-8');
    logger.info(`Updated MODEL in .env to ${modelValue}`);
  } catch (error) {
    // It's okay if .env can't be updated
    logger.warn(`Could not update .env file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function installDependencies(projectPath: string, packageManager?: string): Promise<void> {
  const spinner = yoctoSpinner({ text: 'Installing dependencies...' }).start();

  try {
    // Use provided package manager or detect from environment/globally
    const pm = packageManager || getPackageManager();

    const installCommand = shellQuote.quote([pm, 'install']);

    await exec(installCommand, {
      cwd: projectPath,
    });

    spinner.success('Dependencies installed successfully');
  } catch (error) {
    spinner.error(`Failed to install dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}
