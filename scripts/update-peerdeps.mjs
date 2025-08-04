#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globby } from 'globby';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const execAsync = promisify(exec);

/**
 * Get PR number or commit SHA from git history for a changeset file
 */
async function getChangesetGitInfo(changesetFileName) {
  try {
    // Get the commit that added this changeset file
    const { stdout } = await execAsync(`git log --oneline --follow -- .changeset/${changesetFileName}`, {
      cwd: rootDir,
      encoding: 'utf-8',
    });

    const gitLog = stdout.trim();
    const lines = gitLog.split('\n');
    if (lines.length === 0) return { prNumber: null, commitSha: null };

    // Take the first (most recent) commit
    const firstLine = lines[0];
    const commitMatch = firstLine.match(/^([a-f0-9]+)/);
    const commitSha = commitMatch ? commitMatch[1] : null;

    // Look for PR number in commit message
    const prMatch = firstLine.match(/#(\d+)/);
    const prNumber = prMatch ? prMatch[1] : null;

    return { prNumber, commitSha };
  } catch (error) {
    return { prNumber: null, commitSha: null };
  }
}

/**
 * Parse a changeset markdown file to extract package information
 */
async function parseChangesetFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  let inFrontmatter = false;
  let frontmatterEnd = false;
  const packages = [];

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        frontmatterEnd = true;
        break;
      }
      continue;
    }

    if (inFrontmatter && !frontmatterEnd) {
      // Parse package entries like "'@mastra/core': patch" or '"@mastra/core": patch'
      const match = line.match(/^['"]?(@mastra\/[^'":\s]+)['"]?\s*:\s*\w+/);
      if (match) {
        packages.push(match[1]);
      }
    }
  }

  return packages;
}

/**
 * Get the current version of @mastra/core
 */
async function getCurrentCoreVersion() {
  const corePackageJson = join(rootDir, 'packages/core/package.json');
  const content = await fs.readFile(corePackageJson, 'utf-8');
  const pkg = JSON.parse(content);
  return pkg.version;
}

/**
 * Calculate the next version based on current version and patch increment
 */
function getNextVersion(currentVersion) {
  const parts = currentVersion.split('.');
  if (parts.length === 3) {
    // Handle version like "0.10.7" -> "0.10.8"
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  } else if (parts.length === 4 && parts[3].includes('-alpha.')) {
    // Handle version like "0.10.7-alpha.1" -> "0.10.7-alpha.2"
    const alphaMatch = parts[3].match(/^alpha\.(\d+)$/);
    if (alphaMatch) {
      const alphaNum = parseInt(alphaMatch[1]) + 1;
      return `${parts[0]}.${parts[1]}.${parts[2]}-alpha.${alphaNum}`;
    }
  }

  // Fallback: just increment the last number
  const lastDotIndex = currentVersion.lastIndexOf('.');
  const baseVersion = currentVersion.substring(0, lastDotIndex + 1);
  const lastPart = currentVersion.substring(lastDotIndex + 1);
  const numMatch = lastPart.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0]) + 1;
    const newLastPart = lastPart.replace(/\d+/, num.toString());
    return baseVersion + newLastPart;
  }

  return currentVersion;
}

/**
 * Get all workspace packages from pnpm-workspace.yaml
 */
async function getWorkspacePackages() {
  const workspaceFile = join(rootDir, 'pnpm-workspace.yaml');
  const workspaceContent = await fs.readFile(workspaceFile, 'utf-8');

  // Parse the YAML to extract package patterns
  const patterns = [];
  const ignorePatterns = [];
  const lines = workspaceContent.split('\n');
  let inPackagesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'packages:') {
      inPackagesSection = true;
      continue;
    }

    if (inPackagesSection) {
      if (trimmed.startsWith('- ')) {
        const pattern = trimmed.substring(2).replace(/['"]/g, '');
        if (pattern.startsWith('!')) {
          // Exclusion pattern
          ignorePatterns.push(pattern.substring(1) + '/package.json');
        } else {
          // Include pattern
          patterns.push(pattern + '/package.json');
        }
      } else if (trimmed && !trimmed.startsWith('#')) {
        // End of packages section
        break;
      }
    }
  }

  // Use globby to find all package.json files
  const packageJsonFiles = await globby(patterns, {
    cwd: rootDir,
    ignore: ignorePatterns,
    absolute: true,
  });

  return packageJsonFiles;
}

/**
 * Find package.json file for a given package name
 */
async function findPackageJsonPath(packageName) {
  const workspacePackages = await getWorkspacePackages();

  // Check each package.json to find the one with matching name
  for (const packageJsonPath of workspacePackages) {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      if (pkg.name === packageName) {
        return packageJsonPath;
      }
    } catch (error) {
      // Skip files that can't be read or parsed
      continue;
    }
  }

  return null;
}

/**
 * Update peer dependency constraint for @mastra/core in a package.json
 */
async function updatePeerDependency(packageJsonPath, newVersion) {
  const content = await fs.readFile(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(content);

  if (!pkg.peerDependencies || !pkg.peerDependencies['@mastra/core']) {
    console.log(`  - No @mastra/core peer dependency found, skipping`);
    return false;
  }

  const currentConstraint = pkg.peerDependencies['@mastra/core'];

  // Update the constraint to allow the new version
  // Strip -alpha and replace with -0 for the new version
  const newVersionBase = newVersion.replace(/-alpha\.\d+/, '');
  const newMinVersion = `${newVersionBase}-0`;

  // Parse the current constraint to determine the pattern
  if (currentConstraint.includes('>=') && currentConstraint.includes('<')) {
    // Pattern like ">=0.10.4-0 <0.13.0-0" - update the minimum version
    const match = currentConstraint.match(/>=([^\s]+)\s+<([^\s]+)/);
    if (match) {
      const maxVersionBase = match[2].split('-')[0]; // Get base version without prerelease
      const newMaxVersion = `${maxVersionBase}-0`; // Ensure max version also has -0
      pkg.peerDependencies['@mastra/core'] = `>=${newMinVersion} <${newMaxVersion}`;
    }
  } else {
    // Convert all other patterns to >= < syntax
    const parts = newVersionBase.split('.');
    const majorMinor = `${parts[0]}.${parseInt(parts[1]) + 1}.0`;
    pkg.peerDependencies['@mastra/core'] = `>=${newMinVersion} <${majorMinor}-0`;
  }

  const newConstraint = pkg.peerDependencies['@mastra/core'];
  console.log(`  - Updated: ${currentConstraint} -> ${newConstraint}`);

  // Write back to file
  await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  return true;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Analyzing changeset files...');

  const changesetDir = join(rootDir, '.changeset');
  const files = await fs.readdir(changesetDir);
  const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');

  // Get current and next @mastra/core version
  const currentCoreVersion = await getCurrentCoreVersion();
  const nextCoreVersion = getNextVersion(currentCoreVersion);

  console.log(`📦 Current @mastra/core version: ${currentCoreVersion}`);
  console.log(`📦 Next @mastra/core version: ${nextCoreVersion}`);
  console.log('');

  // Collect all packages that need updates
  const packagesToUpdate = new Set();

  for (const file of mdFiles) {
    const filePath = join(changesetDir, file);
    try {
      const packages = await parseChangesetFile(filePath);

      // Check if this changeset has @mastra/core and at least 2 packages
      if (packages.length >= 2 && packages.includes('@mastra/core')) {
        const { prNumber, commitSha } = await getChangesetGitInfo(file);

        let summary = `✅ ${file}: Found ${packages.length} packages including @mastra/core`;
        if (prNumber) {
          summary += ` (PR #${prNumber})`;
        } else if (commitSha) {
          summary += ` (${commitSha})`;
        }
        console.log(summary);

        // Add all packages except @mastra/core to the update list
        packages.forEach(pkg => {
          if (pkg !== '@mastra/core') {
            packagesToUpdate.add(pkg);
          }
        });
      }
    } catch (error) {
      console.log(`❌ Error parsing ${file}: ${error.message}`);
    }
  }

  if (packagesToUpdate.size === 0) {
    console.log('ℹ️  No packages found that need peer dependency updates');
    return;
  }

  console.log(`\n🔧 Updating peer dependencies for ${packagesToUpdate.size} packages...\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const packageName of packagesToUpdate) {
    console.log(`📝 Processing ${packageName}:`);

    const packageJsonPath = await findPackageJsonPath(packageName);
    if (!packageJsonPath) {
      console.log(`  - ❌ Could not find package.json for ${packageName}`);
      skippedCount++;
      continue;
    }

    console.log(`  - Found: ${packageJsonPath.replace(rootDir, '.')}`);

    try {
      const wasUpdated = await updatePeerDependency(packageJsonPath, nextCoreVersion);
      if (wasUpdated) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.log(`  - ❌ Error updating: ${error.message}`);
      skippedCount++;
    }

    console.log('');
  }

  console.log(`✨ Summary:`);
  console.log(`   - Updated: ${updatedCount} packages`);
  console.log(`   - Skipped: ${skippedCount} packages`);
  console.log(`   - Total processed: ${updatedCount + skippedCount} packages`);
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
