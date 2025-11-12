#!/usr/bin/env node

/**
 * Local Template Sync Script
 *
 * This script syncs templates from the monorepo to individual template repositories.
 * Unlike the CI version, this can be run locally with your GitHub token.
 *
 * Usage:
 *   node .github/scripts/sync-templates-local.js [branch]
 *
 * Examples:
 *   node .github/scripts/sync-templates-local.js main    # Sync to main branch
 *   node .github/scripts/sync-templates-local.js beta    # Sync to beta branch
 *
 * Environment Variables:
 *   GITHUB_TOKEN - Your GitHub personal access token (required)
 *   ORGANIZATION - GitHub organization (default: mastra-ai)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configuration
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');
const ORGANIZATION = process.env.ORGANIZATION || 'mastra-ai';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TARGET_BRANCH = process.argv[2] || 'main';

// Git configuration
const GIT_USER_NAME = 'Mastra Bot';
const GIT_USER_EMAIL = 'bot@mastra.ai';

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      info: '📝',
      success: '✅',
      error: '❌',
      warn: '⚠️',
    }[level] || '📝';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

async function syncTemplate(templateName, templatePath) {
  log(`\n${'='.repeat(60)}`);
  log(`Syncing template: ${templateName}`, 'info');
  log(`${'='.repeat(60)}`);

  const repoName = templateName;
  const repoUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/${ORGANIZATION}/${repoName}.git`;
  const tempDir = path.join('/tmp', `mastra-template-sync-${Date.now()}-${templateName}`);

  try {
    // Check if repo exists by trying to clone it
    log(`Checking if repository ${ORGANIZATION}/${repoName} exists...`);
    execCommand(`git ls-remote ${repoUrl}`, { silent: true, ignoreError: true });

    log(`Cloning ${ORGANIZATION}/${repoName} to ${tempDir}...`);
    execCommand(`git clone ${repoUrl} ${tempDir}`, { silent: false });

    // Configure git
    execCommand(`git config user.name "${GIT_USER_NAME}"`, { cwd: tempDir });
    execCommand(`git config user.email "${GIT_USER_EMAIL}"`, { cwd: tempDir });

    // Check if target branch exists, create if it doesn't
    log(`Checking out ${TARGET_BRANCH} branch...`);
    const branches = execCommand(`git branch -r`, { cwd: tempDir, silent: true });
    const branchExists = branches?.includes(`origin/${TARGET_BRANCH}`);

    if (branchExists) {
      execCommand(`git checkout ${TARGET_BRANCH}`, { cwd: tempDir });
    } else {
      log(`Branch ${TARGET_BRANCH} doesn't exist, creating it...`, 'warn');
      execCommand(`git checkout -b ${TARGET_BRANCH}`, { cwd: tempDir });
    }

    // Clear existing content (except .git)
    log(`Clearing existing content in ${TARGET_BRANCH} branch...`);
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      if (file !== '.git') {
        const filePath = path.join(tempDir, file);
        execCommand(`rm -rf "${filePath}"`, { cwd: tempDir });
      }
    }

    // Copy template files
    log(`Copying template files from ${templatePath}...`);
    const templateFiles = fs.readdirSync(templatePath);
    for (const file of templateFiles) {
      const srcPath = path.join(templatePath, file);
      const destPath = path.join(tempDir, file);

      if (fs.statSync(srcPath).isDirectory()) {
        execCommand(`cp -r "${srcPath}" "${destPath}"`, { cwd: tempDir });
      } else {
        execCommand(`cp "${srcPath}" "${destPath}"`, { cwd: tempDir });
      }
    }

    // Stage all changes
    log(`Staging changes...`);
    execCommand(`git add -A`, { cwd: tempDir });

    // Check if there are changes to commit
    const status = execCommand(`git status --porcelain`, { cwd: tempDir, silent: true });

    if (!status || status.trim() === '') {
      log(`No changes detected for ${templateName}`, 'warn');
      return { success: true, hasChanges: false };
    }

    // Commit changes
    const commitMessage = `chore: sync template from monorepo

Synced from mastra-ai/mastra monorepo
Branch: ${TARGET_BRANCH}
Timestamp: ${new Date().toISOString()}`;

    log(`Committing changes...`);
    execCommand(`git commit -m "${commitMessage}"`, { cwd: tempDir });

    // Push changes
    log(`Pushing to ${TARGET_BRANCH} branch...`);
    execCommand(`git push origin ${TARGET_BRANCH}`, { cwd: tempDir });

    log(`Successfully synced ${templateName} to ${TARGET_BRANCH} branch`, 'success');
    return { success: true, hasChanges: true };
  } catch (error) {
    log(`Error syncing ${templateName}: ${error.message}`, 'error');
    return { success: false, error: error.message };
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      log(`Cleaning up temporary directory...`);
      execCommand(`rm -rf "${tempDir}"`, { ignoreError: true });
    }
  }
}

async function main() {
  log(`\n${'='.repeat(60)}`);
  log(`🚀 Mastra Template Sync - Local Version`);
  log(`${'='.repeat(60)}`);
  log(`Target branch: ${TARGET_BRANCH}`);
  log(`Organization: ${ORGANIZATION}`);
  log(`Templates directory: ${TEMPLATES_DIR}`);
  log(`${'='.repeat(60)}\n`);

  // Validate environment
  if (!GITHUB_TOKEN) {
    log('GITHUB_TOKEN environment variable is required!', 'error');
    log('Set it with: export GITHUB_TOKEN=your_token_here', 'info');
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATES_DIR)) {
    log(`Templates directory not found: ${TEMPLATES_DIR}`, 'error');
    process.exit(1);
  }

  // Get all template directories
  const templateDirs = fs.readdirSync(TEMPLATES_DIR).filter(file => {
    const fullPath = path.join(TEMPLATES_DIR, file);
    return fs.statSync(fullPath).isDirectory();
  });

  if (templateDirs.length === 0) {
    log('No template directories found!', 'error');
    process.exit(1);
  }

  log(`Found ${templateDirs.length} templates to sync:\n${templateDirs.map(t => `  - ${t}`).join('\n')}\n`);

  const results = {
    total: templateDirs.length,
    successful: 0,
    failed: 0,
    noChanges: 0,
    errors: [],
  };

  // Sync each template
  for (const templateDir of templateDirs) {
    const templatePath = path.join(TEMPLATES_DIR, templateDir);
    const result = await syncTemplate(templateDir, templatePath);

    if (result.success) {
      if (result.hasChanges) {
        results.successful++;
      } else {
        results.noChanges++;
      }
    } else {
      results.failed++;
      results.errors.push({ template: templateDir, error: result.error });
    }
  }

  // Print summary
  log(`\n${'='.repeat(60)}`);
  log(`📊 Sync Summary`);
  log(`${'='.repeat(60)}`);
  log(`Total templates: ${results.total}`);
  log(`Successfully synced: ${results.successful}`, 'success');
  log(`No changes: ${results.noChanges}`, 'warn');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');

  if (results.errors.length > 0) {
    log(`\n❌ Failed templates:`);
    results.errors.forEach(({ template, error }) => {
      log(`  - ${template}: ${error}`, 'error');
    });
  }

  log(`${'='.repeat(60)}\n`);

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
