const { Octokit } = require('@octokit/rest');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');
const ORGANIZATION = process.env.ORGANIZATION;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
      await processTemplate(templateName);
    }
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

async function processTemplate(templateName) {
  console.log(`Processing template: ${templateName}`);

  try {
    // Check if repo exists
    const repoExists = await checkRepoExists(templateName);

    if (repoExists) {
      console.log(`Repository ${templateName} exists, updating...`);
      await updateExistingRepo(templateName);
    } else {
      console.log(`Repository ${templateName} does not exist, creating...`);
      await createNewRepo(templateName);
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

async function createNewRepo(repoName) {
  // Create new repository
  await octokit.repos.createInOrg({
    org: ORGANIZATION,
    name: repoName,
    description: `Template repository for ${repoName}`,
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
  const templatePath = path.join(TEMPLATES_DIR, repoName);
  const tempDir = path.join(process.cwd(), '.temp', repoName);

  try {
    // Create temp directory
    fs.ensureDirSync(tempDir);

    // Copy template content to temp directory
    fs.copySync(templatePath, tempDir);

    // Initialize git and push to repo
    execSync(
      `
      cd ${tempDir} &&
      git init &&
      git config user.name "GitHub Actions" &&
      git config user.email "actions@github.com" &&
      git add . &&
      git commit -m "Update template from monorepo" &&
      git remote add origin https://x-access-token:${GITHUB_TOKEN}@github.com/${ORGANIZATION}/${repoName}.git &&
      git push -u origin main --force
    `,
      { stdio: 'inherit' },
    );

    console.log(`Successfully pushed template to ${repoName}`);
  } finally {
    // Clean up temp directory
    fs.removeSync(path.join(process.cwd(), '.temp'));
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
