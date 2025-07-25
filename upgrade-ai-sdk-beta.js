#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AI SDK package version mappings from current beta to latest beta
const VERSION_MAPPINGS = {
  ai: {
    '5.0.0-beta.5': '5.0.0-beta.27',
    '5.0.0-beta.14': '5.0.0-beta.27',
  },
  '@ai-sdk/provider': {
    '2.0.0-alpha.15': '2.0.0-beta.1',
    '2.0.0-beta.5': '2.0.0-beta.1',
  },
  '@ai-sdk/openai': {
    '2.0.0-beta.5': '2.0.0-beta.11',
    '2.0.0-beta.6': '2.0.0-beta.11',
  },
  '@ai-sdk/react': {
    '2.0.0-alpha.15': '2.0.0-beta.27',
    '2.0.0-beta.1': '2.0.0-beta.27',
    '2.0.0-beta.2': '2.0.0-beta.27',
    '2.0.0-beta.3': '2.0.0-beta.27',
    '2.0.0-beta.4': '2.0.0-beta.27',
    '2.0.0-beta.5': '2.0.0-beta.27',
    '1.0.0': '2.0.0-beta.27', // Major upgrade
  },
  '@ai-sdk/anthropic': {
    '2.0.0-beta.1': '2.0.0-beta.8',
    '2.0.0-beta.2': '2.0.0-beta.8',
    '2.0.0-beta.3': '2.0.0-beta.8',
    '2.0.0-beta.4': '2.0.0-beta.8',
    '2.0.0-beta.5': '2.0.0-beta.8',
    '1.0.0': '2.0.0-beta.8', // Major upgrade
  },
  '@ai-sdk/google': {
    '2.0.0-beta.1': '2.0.0-beta.14',
    '2.0.0-beta.2': '2.0.0-beta.14',
    '2.0.0-beta.3': '2.0.0-beta.14',
    '2.0.0-beta.4': '2.0.0-beta.14',
    '2.0.0-beta.5': '2.0.0-beta.14',
    '1.0.0': '2.0.0-beta.14', // Major upgrade
  },
  '@ai-sdk/provider-utils': {
    '^3.0.0-alpha.14': '3.0.0-beta.5',
    '3.0.0-beta.1': '3.0.0-beta.5',
    '3.0.0-beta.2': '3.0.0-beta.5',
    '3.0.0-beta.3': '3.0.0-beta.5',
    '3.0.0-beta.4': '3.0.0-beta.5',
    '2.2.8': '3.0.0-beta.5', // Major upgrade
  },
  '@ai-sdk/ui-utils': {
    '2.0.0-beta.1': '2.0.0-canary.3',
    '2.0.0-beta.2': '2.0.0-canary.3',
    '2.0.0-beta.3': '2.0.0-canary.3',
    '2.0.0-beta.4': '2.0.0-canary.3',
    '2.0.0-beta.5': '2.0.0-canary.3',
    '^1.2.11': '2.0.0-canary.3', // Major upgrade
  },
  '@ai-sdk/cohere': {
    '2.0.0-beta.11': '2.0.0-beta.6',
    '2.0.0-beta.1': '2.0.0-beta.6',
    '2.0.0-beta.2': '2.0.0-beta.6',
    '2.0.0-beta.3': '2.0.0-beta.6',
    '2.0.0-beta.4': '2.0.0-beta.6',
    '2.0.0-beta.5': '2.0.0-beta.6',
    '1.0.0': '2.0.0-beta.6', // Major upgrade
  },
};

// AI SDK packages to look for
const AI_SDK_PACKAGES = [
  'ai',
  '@ai-sdk/provider',
  '@ai-sdk/openai',
  '@ai-sdk/react',
  '@ai-sdk/anthropic',
  '@ai-sdk/google',
  '@ai-sdk/provider-utils',
  '@ai-sdk/ui-utils',
  '@ai-sdk/gateway',
  '@ai-sdk/cohere',
];

async function findPackageJsonFiles(dir = '.') {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name === 'package.json') {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

async function analyzePackageJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const pkg = JSON.parse(content);
    const found = {};

    // Check all dependency sections
    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

    for (const section of sections) {
      if (pkg[section]) {
        for (const pkgName of AI_SDK_PACKAGES) {
          if (pkg[section][pkgName]) {
            if (!found[section]) found[section] = {};
            found[section][pkgName] = pkg[section][pkgName];
          }
        }
      }
    }

    return Object.keys(found).length > 0 ? { path: filePath, packages: found } : null;
  } catch (error) {
    console.warn(`Warning: Could not parse ${filePath}:`, error.message);
    return null;
  }
}

async function updatePackageJson(filePath, updates) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const pkg = JSON.parse(content);
    let modified = false;

    for (const [section, packages] of Object.entries(updates)) {
      if (pkg[section]) {
        for (const [pkgName, newVersion] of Object.entries(packages)) {
          if (pkg[section][pkgName]) {
            console.log(`  ${pkgName}: ${pkg[section][pkgName]} → ${newVersion}`);
            pkg[section][pkgName] = newVersion;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      await fs.writeFile(filePath, JSON.stringify(pkg, null, 2) + '\n');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

function getNewVersion(packageName, currentVersion) {
  const mappings = VERSION_MAPPINGS[packageName];
  if (!mappings) {
    // Default beta version for unmapped packages
    if (packageName === 'ai') return '5.0.0-beta.27';
    if (packageName.startsWith('@ai-sdk/')) {
      return '2.0.0-beta.11'; // Most @ai-sdk packages are on 2.x
    }
    return currentVersion; // Keep unchanged if no mapping
  }

  // Exact match first
  if (mappings[currentVersion]) {
    return mappings[currentVersion];
  }

  // Handle caret/tilde prefixes
  const cleanVersion = currentVersion.replace(/^[\^~]/, '');
  if (mappings[cleanVersion]) {
    const newVersion = mappings[cleanVersion];
    // For beta versions, always use exact version (no caret/tilde)
    if (newVersion.includes('-beta.')) {
      return newVersion;
    }
    return currentVersion.startsWith('^')
      ? newVersion.replace(/^[\^~]/, '^')
      : currentVersion.startsWith('~')
        ? newVersion.replace(/^[\^~]/, '~')
        : newVersion;
  }

  // Default fallback
  console.warn(`  Warning: No mapping found for ${packageName}@${currentVersion}, skipping`);
  return currentVersion;
}

async function removeOverrides() {
  const rootPackageJsonPath = './package.json';
  try {
    const content = await fs.readFile(rootPackageJsonPath, 'utf8');
    const pkg = JSON.parse(content);
    let modified = false;

    // Remove pnpm overrides for AI SDK packages
    if (pkg.pnpm && pkg.pnpm.overrides) {
      for (const pkgName of AI_SDK_PACKAGES) {
        if (pkg.pnpm.overrides[pkgName]) {
          console.log(`Removing pnpm override for ${pkgName}`);
          delete pkg.pnpm.overrides[pkgName];
          modified = true;
        }
      }

      // Clean up empty overrides
      if (Object.keys(pkg.pnpm.overrides).length === 0) {
        delete pkg.pnpm.overrides;
      }
      if (Object.keys(pkg.pnpm).length === 0) {
        delete pkg.pnpm;
      }
    }

    // Remove resolutions for AI SDK packages
    if (pkg.resolutions) {
      for (const pkgName of AI_SDK_PACKAGES) {
        if (pkg.resolutions[pkgName]) {
          console.log(`Removing resolution for ${pkgName}`);
          delete pkg.resolutions[pkgName];
          modified = true;
        }
      }

      if (Object.keys(pkg.resolutions).length === 0) {
        delete pkg.resolutions;
      }
    }

    if (modified) {
      await fs.writeFile(rootPackageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log('✅ Updated root package.json to remove AI SDK overrides');
    }
  } catch (error) {
    console.warn('Warning: Could not update root package.json:', error.message);
  }
}

async function main() {
  console.log('🔍 AI SDK Alpha → Beta Upgrade Script');
  console.log('=====================================\n');

  // Step 1: Find all package.json files
  console.log('📂 Finding package.json files...');
  const packageFiles = await findPackageJsonFiles();
  console.log(`Found ${packageFiles.length} package.json files\n`);

  // Step 2: Analyze packages with AI SDK dependencies
  console.log('🔎 Analyzing AI SDK dependencies...');
  const packagesWithAiSdk = [];

  for (const filePath of packageFiles) {
    const analysis = await analyzePackageJson(filePath);
    if (analysis) {
      packagesWithAiSdk.push(analysis);
    }
  }

  if (packagesWithAiSdk.length === 0) {
    console.log('❌ No AI SDK packages found!');
    return;
  }

  console.log(`Found AI SDK packages in ${packagesWithAiSdk.length} files:\n`);

  // Step 3: Show what will be updated
  let totalUpdates = 0;
  for (const { path: filePath, packages } of packagesWithAiSdk) {
    console.log(`📦 ${path.relative('.', filePath)}:`);

    for (const [section, deps] of Object.entries(packages)) {
      for (const [pkgName, currentVersion] of Object.entries(deps)) {
        const newVersion = getNewVersion(pkgName, currentVersion);
        if (newVersion !== currentVersion) {
          console.log(`  ${section}.${pkgName}: ${currentVersion} → ${newVersion}`);
          totalUpdates++;
        } else {
          console.log(`  ${section}.${pkgName}: ${currentVersion} (no change)`);
        }
      }
    }
    console.log();
  }

  if (totalUpdates === 0) {
    console.log('ℹ️  No updates needed - all packages are already up to date!');
    return;
  }

  console.log(`🚀 Ready to update ${totalUpdates} package references\n`);

  // Step 4: Perform updates
  console.log('📝 Updating package.json files...');
  let updatedFiles = 0;

  for (const { path: filePath, packages } of packagesWithAiSdk) {
    const updates = {};
    let hasUpdates = false;

    for (const [section, deps] of Object.entries(packages)) {
      for (const [pkgName, currentVersion] of Object.entries(deps)) {
        const newVersion = getNewVersion(pkgName, currentVersion);
        if (newVersion !== currentVersion) {
          if (!updates[section]) updates[section] = {};
          updates[section][pkgName] = newVersion;
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      console.log(`\n📝 Updating ${path.relative('.', filePath)}:`);
      const success = await updatePackageJson(filePath, updates);
      if (success) {
        updatedFiles++;
        console.log('✅ Updated successfully');
      }
    }
  }

  // Step 5: Remove overrides
  console.log('\n🧹 Removing AI SDK overrides from root package.json...');
  await removeOverrides();

  // Step 6: Summary
  console.log('\n🎉 Upgrade Summary:');
  console.log('==================');
  console.log(`📦 Files updated: ${updatedFiles}`);
  console.log(`🔄 Total package updates: ${totalUpdates}`);
  console.log('\n📋 Next steps:');
  console.log('1. Run: pnpm install');
  console.log('2. Run: pnpm build');
  console.log('3. Test your application');
  console.log('\n✨ AI SDK beta upgrade complete!');
}

// Run the script
main().catch(console.error);
