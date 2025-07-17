import { Octokit } from '@octokit/rest';
import fs from 'fs';
import { readFile, writeFile } from 'fs/promises';
import * as fsExtra from 'fs-extra/esm';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');
const ORGANIZATION = process.env.ORGANIZATION;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;
const EMAIL = process.env.EMAIL;

const PROVIDERS = {
  openai: {
    model: 'gpt-4.1',
    package: '@ai-sdk/openai',
    apiKey: 'OPENAI_API_KEY',
    name: 'OpenAI',
    url: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    model: 'claude-3-5-sonnet-20240620',
    package: '@ai-sdk/anthropic',
    apiKey: 'ANTHROPIC_API_KEY',
    name: 'Anthropic',
    url: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    model: 'gemini-2.5-pro',
    package: '@ai-sdk/google',
    apiKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    name: 'Google',
    url: 'https://console.cloud.google.com/apis/credentials',
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    package: '@ai-sdk/groq',
    apiKey: 'GROQ_API_KEY',
    name: 'Groq',
    url: 'https://console.groq.com/keys',
  },
};

// Initialize Octokit
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

async function main() {
  try {
    // Get all template directories
    const templateDirs = fs
      .readdirSync(TEMPLATES_DIR)
      .filter(file => fs.statSync(path.join(TEMPLATES_DIR, file)).isDirectory());

    console.log(`Found ${templateDirs.length} templates: ${templateDirs.join(', ')}`);

    // Process each template
    for (const templateName of templateDirs) {
      //pick description text from package.json
      const packageJsonFile = fs.readFileSync(path.join(TEMPLATES_DIR, templateName, 'package.json'), 'utf-8');
      const packageJson = JSON.parse(packageJsonFile);
      const description = packageJson.description || '';
      console.log(`Description for ${templateName}: ${description}`);
      await processTemplate(templateName, description);
    }
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

async function processTemplate(templateName, description) {
  console.log(`Processing template: ${templateName}`);

  try {
    // Check if repo exists
    const repoExists = await checkRepoExists(templateName);

    if (repoExists) {
      console.log(`Repository ${templateName} exists, updating...`);
      await updateExistingRepo(templateName);
    } else {
      console.log(`Repository ${templateName} does not exist, creating...`);
      await createNewRepo(templateName, description);
    }
  } catch (error) {
    console.error(`Error processing template ${templateName}:`, error);
  }
}

async function checkRepoExists(repoName) {
  try {
    await octokit.repos.get({
      owner: ORGANIZATION,
      repo: repoName,
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

async function createNewRepo(repoName, description) {
  // Create new repository
  await octokit.repos.createInOrg({
    org: ORGANIZATION,
    name: repoName,
    description: description || `Template repository for ${repoName}`,
    is_template: true, // Make it a template repository
    auto_init: false,
  });

  console.log(`Created new repository: ${repoName}`);

  // Push template code to the new repository
  await pushToRepo(repoName);
}

async function updateExistingRepo(repoName) {
  // Push updated template code to the existing repository
  await pushToRepo(repoName);
}

async function pushToRepo(repoName) {
  console.log(`Pushing to new repo: ${repoName}`);
  const templatePath = path.join(TEMPLATES_DIR, repoName);
  const tempDir = path.join(process.cwd(), '.temp', repoName);

  try {
    // Create temp directory
    console.log(`Creating temp directory: ${tempDir}`);
    fsExtra.ensureDirSync(tempDir);

    // Copy template content to temp directory
    console.log(`Copying template content to temp directory: ${tempDir}`);
    fsExtra.copySync(templatePath, tempDir);

    // Initialize git and push to repo
    console.log(`Initializing git and pushing to repo: ${repoName}`);
    execSync(
      `
      git init &&
      git config user.name "${USERNAME}" &&
      git config user.email "${EMAIL}" &&
      git add . &&
      git commit -m "Update template from monorepo" &&
      git branch -M main &&
      git remote add origin https://x-access-token:${GITHUB_TOKEN}@github.com/${ORGANIZATION}/${repoName}.git  &&
      git push -u origin main --force
    `,
      { stdio: 'inherit', cwd: tempDir },
    );

    // setup different branches
    // TODO make more dynamic
    for (const [
      provider,
      { model: defaultModel, package: providerPackage, apiKey: providerApiKey, name: providerName, url: providerUrl },
    ] of Object.entries(PROVIDERS)) {
      const files = ['./src/mastra/workflows/index.ts', './src/mastra/agents/index.ts'];
      // move to new branch
      execSync(`git checkout main && git switch -c ${provider}`, { stdio: 'inherit', cwd: tempDir });

      //update llm provider in workflows and agents
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        if (fs.existsSync(filePath)) {
          console.log(`Updating ${filePath}`);
          let content = await readFile(filePath, 'utf-8');
          content = content.replaceAll(
            `import { openai } from '@ai-sdk/openai';`,
            `import { ${provider} } from '${providerPackage}';`,
          );
          content = content.replaceAll(
            /openai\((['"])[^'"]*(['"])\)/g,
            `${provider}(process.env.MODEL ?? "${defaultModel}")`,
          );
          await writeFile(filePath, content);
        } else {
          console.log(`${filePath} does not exist`);
        }
      }

      //update llm provider in package.json
      console.log(`Updating package.json for ${provider}`);
      const latestVersion = await getLatestVersion(providerPackage);
      const packageJsonPath = path.join(tempDir, 'package.json');
      let packageJson = await readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageJson);
      delete packageJson.dependencies['@ai-sdk/openai'];
      packageJson.dependencies[providerPackage] = `^${latestVersion}`;
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      //update llm provider in .env.example
      console.log(`Updating .env.example for ${provider}`);
      const envExamplePath = path.join(tempDir, '.env.example');
      let envExample = await readFile(envExamplePath, 'utf-8');
      envExample = envExample.replace('OPENAI_API_KEY', providerApiKey);
      envExample = envExample + `\nMODEL=${defaultModel}`;
      await writeFile(envExamplePath, envExample);

      //update llm provider in README.md
      console.log(`Updating README.md for ${provider}`);
      const readmePath = path.join(tempDir, 'README.md');
      let readme = await readFile(readmePath, 'utf-8');
      readme = readme.replace('OpenAI', providerName);
      readme = readme.replace('OPENAI_API_KEY', providerApiKey);
      readme = readme.replace('https://platform.openai.com/api-keys', providerUrl);
      await writeFile(readmePath, readme);

      // push branch
      execSync(
        `
        git add . &&
        git commit -m "Update llm provider to ${provider}" &&
        git push -u origin ${provider} --force
    `,
        { stdio: 'inherit', cwd: tempDir },
      );
    }

    console.log(`Successfully pushed template to ${repoName}`);
  } catch (error) {
    console.error(`Error pushing template to ${repoName}`, error);
    throw error;
  } finally {
    // Clean up temp directory
    console.log(`Cleaning up temp directory: ${tempDir}`);
    fsExtra.removeSync(path.join(process.cwd(), '.temp'));
  }
}

async function getLatestVersion(packageName) {
  try {
    return execSync(`npm view ${packageName} version`, { stdio: 'pipe' }).toString().trim();
  } catch (error) {
    console.error(`Error getting latest version of ${packageName}`, error);
    throw error;
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
