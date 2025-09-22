import { promises as fs } from 'fs';
import path from 'path';

const IGNORE_LIST = [
  '@internal',
  '@mastra/memory-integration-tests',
  '@mastra/longmemeval',
  '@mastra/mcp-configuration',
];

const ALLOW_LIST = ['mastra', 'create-mastra', '@mastra'];

const ROOT_DIR = process.cwd();

const REPOSITORY_URL = 'git+https://github.com/mastra-ai/mastra.git';
const HOMEPAGE = 'https://mastra.ai';
const ISSUES_URL = 'https://github.com/mastra-ai/mastra/issues';

/**
 * Recursively finds all package.json files in a directory.
 * @param {string} dir - Directory to search from
 * @returns {Promise<string[]>} Array of absolute file paths
 */
async function findPackageJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const res = path.resolve(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        return findPackageJsonFiles(res);
      } else if (entry.isFile() && entry.name === 'package.json') {
        return [res];
      }
      return [];
    }),
  );
  return files.flat();
}

/**
 * Determines if a package should be checked based on its name and privacy.
 * @param {object} pkg - The parsed package.json object
 * @param {string} pkg.name
 * @param {boolean} [pkg.private]
 * @returns {boolean}
 */
function shouldCheckPackage(pkg) {
  if (pkg.private === true) return false;
  if (!pkg.name) return false;
  if (IGNORE_LIST.some(prefix => pkg.name.startsWith(prefix))) return false;
  return ALLOW_LIST.some(prefix => pkg.name.startsWith(prefix));
}

/**
 * Gets the relative directory path from the repo root for a given file.
 * @param {string} file - Absolute path to the file
 * @returns {string}
 */
function getRelativeDirectory(file) {
  return path.relative(ROOT_DIR, path.dirname(file));
}

/**
 * Main entry point for validation script.
 * @returns {Promise<void>}
 */
async function main() {
  const pkgFiles = await findPackageJsonFiles(ROOT_DIR);
  const rootPkgJson = path.join(ROOT_DIR, 'package.json');
  let hasError = false;
  const checkedFiles = new Set();

  for (const file of pkgFiles) {
    if (file === rootPkgJson) continue;

    const content = await fs.readFile(file, 'utf8');
    let pkg;
    try {
      pkg = JSON.parse(content);
    } catch (e) {
      console.error(`❌ Invalid JSON in ${file}`);
      hasError = true;
      continue;
    }
    if (!shouldCheckPackage(pkg)) continue;

    // Check files array
    const filesArr = pkg.files || [];
    const missing = ['dist', 'CHANGELOG.md'].filter(f => !filesArr.includes(f));
    if (missing.length > 0) {
      console.log(`❌ ${file}: missing ${missing.join(', ')}`);
      hasError = true;
    }

    // Check repository
    const relDir = getRelativeDirectory(file);
    if (!pkg.repository) {
      console.log(`❌ ${file}: missing repository field`);
      hasError = true;
    } else {
      if (pkg.repository.type !== 'git') {
        console.log(`❌ ${file}: repository.type should be "git"`);
        hasError = true;
      }
      if (pkg.repository.url !== REPOSITORY_URL) {
        console.log(`❌ ${file}: repository.url should be "${REPOSITORY_URL}"`);
        hasError = true;
      }
      if (pkg.repository.directory !== relDir) {
        console.log(`❌ ${file}: repository.directory should be "${relDir}"`);
        hasError = true;
      }
    }

    // Check homepage
    if (!pkg.homepage) {
      console.log(`❌ ${file}: missing homepage field`);
      hasError = true;
    } else if (pkg.homepage !== HOMEPAGE) {
      console.log(`❌ ${file}: homepage should be "${HOMEPAGE}"`);
      hasError = true;
    }

    // Check bugs
    if (!pkg.bugs) {
      console.log(`❌ ${file}: missing bugs field`);
      hasError = true;
    } else if (pkg.bugs.url !== ISSUES_URL) {
      console.log(`❌ ${file}: bugs.url should be "${ISSUES_URL}"`);
      hasError = true;
    }

    checkedFiles.add(file);
  }

  if (!hasError) {
    console.log(`✅ All checked package.json files passed validation.
Total: ${checkedFiles.size} files`);
  } else {
    process.exit(1);
  }
}

main();
