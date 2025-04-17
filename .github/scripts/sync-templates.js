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
      //pick description text from description.txt
      const description = fs.readFileSync(path.join(TEMPLATES_DIR, templateName, 'description.txt'), 'utf-8');
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
      cd ${tempDir} &&
      git init &&
      git config user.name "${USERNAME}" &&
      git config user.email "${EMAIL}" &&
      git add . &&
      git commit -m "Update template from monorepo" &&
      git branch -M main &&
      git remote add origin https://x-access-token:${GITHUB_TOKEN}@github.com/${ORGANIZATION}/${repoName}.git &&
      git push -u origin main --force
    `,
      { stdio: 'inherit' },
    );

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
