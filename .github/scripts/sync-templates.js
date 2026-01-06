import { Octokit } from '@octokit/rest';
import fs from 'fs';
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

// Validate required environment variables
const requiredEnvVars = { ORGANIZATION, GITHUB_TOKEN, USERNAME, EMAIL };
for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`Error: Required environment variable ${name} is not set`);
    process.exit(1);
  }
}

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
      await updateExistingRepo(templateName, description);
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

async function updateExistingRepo(repoName, description) {
  try {
    console.log(`Updating ${repoName} description`);
    // Update existing repo description
    await octokit.repos.update({
      owner: ORGANIZATION,
      repo: repoName,
      description: description || `Template repository for ${repoName}`,
    });

    console.log(`Updated ${repoName} description`);
  } catch (error) {
    console.error(`Error updating ${repoName} description:`, error);
  }
  // Push updated template code to the existing repository
  await pushToRepo(repoName);
}

async function pushToRepo(repoName) {
  console.log(`Pushing to new repo: ${repoName}`);
  const templatePath = path.join(TEMPLATES_DIR, repoName);
  const tempRoot = path.join(process.cwd(), '.temp');
  const tempDir = path.join(tempRoot, repoName);

  try {
    // Create temp directory
    console.log(`Creating temp directory: ${tempRoot}`);
    fsExtra.ensureDirSync(tempRoot);

    console.log(`Cloning repo into temp directory: ${tempRoot}`);
    execSync(
      ` 
      git config --global user.name "${USERNAME}" &&
      git config --global user.email "${EMAIL}" && 
      git clone https://x-access-token:${GITHUB_TOKEN}@github.com/${ORGANIZATION}/${repoName}.git &&
      cd ${repoName} &&
      git fetch origin
      `,
      {
        stdio: 'inherit',
        cwd: tempRoot,
      },
    );

    try {
      console.log(`Check out to beta branch in local`);
      execSync(
        `
      git checkout beta &&
      git pull origin beta
      `,
        {
          stdio: 'inherit',
          cwd: tempDir,
        },
      );
    } catch (error) {
      console.log(`No beta branch found in local, creating new beta branch`);
      execSync(
        `
        git checkout -b beta
      `,
        { stdio: 'inherit', cwd: tempDir },
      );
    }

    // remove everything in the temp directory except .git
    console.log(`Removing everything (except .git) in the temp directory: ${tempDir}`);

    // get all files and directories in the temp directory
    const filesAndDirs = fs.readdirSync(tempDir);
    console.log(`Found ${filesAndDirs.length} files and directories in the temp directory: ${tempDir}`);
    // remove all files and directories in the temp directory except .git
    for (const fileOrDir of filesAndDirs) {
      if (fileOrDir !== '.git') {
        console.log(`Removing ${fileOrDir} in the temp directory: ${tempDir}`);
        fsExtra.removeSync(path.join(tempDir, fileOrDir));
      }
    }

    const filesAndDirsPostDelete = fs.readdirSync(tempDir);
    console.log(`Files and directories left after delete: ${filesAndDirsPostDelete.join(', ')}`);

    // Copy template content to temp directory
    console.log(`Copying template content to temp directory: ${tempDir}`);
    fsExtra.copySync(templatePath, tempDir);

    // Initialize git and push to repo
    console.log(`Pushing to beta branch`);
    try {
      execSync(
        `
      git add . &&
      git commit -m "Update template from monorepo (beta v1.0)" &&
      git push origin beta
    `,
        { stdio: 'inherit', cwd: tempDir },
      );
    } catch (error) {
      console.log(`No changes to push to beta branch, skipping`);
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

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
