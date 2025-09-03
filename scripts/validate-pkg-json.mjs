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

function shouldCheckPackage(name) {
  if (!name) return false;
  if (IGNORE_LIST.some(prefix => name.startsWith(prefix))) return false;
  return ALLOW_LIST.some(prefix => name.startsWith(prefix));
}

async function main() {
  const pkgFiles = await findPackageJsonFiles(ROOT_DIR);
  const rootPkgJson = path.join(ROOT_DIR, 'package.json');
  let hasError = false;

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
    if (pkg.private === true) continue;
    if (!shouldCheckPackage(pkg.name)) continue;

    const filesArr = pkg.files || [];
    const missing = ['dist', 'CHANGELOG.md'].filter(f => !filesArr.includes(f));
    if (missing.length > 0) {
      console.log(`❌ ${file}: missing ${missing.join(', ')}`);
      hasError = true;
    }
  }

  if (!hasError) {
    console.log('✅ All checked package.json files contain "dist" and "CHANGELOG.md" in files array.');
  } else {
    process.exit(1);
  }
}

main();
