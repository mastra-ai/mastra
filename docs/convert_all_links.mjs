import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, 'src', 'content', 'en');
const REFERENCE_DIR = path.join(BASE_DIR, 'reference');

// URL to directory mapping
const URL_MAPPINGS = {
  '/docs/v1/': 'docs/',
  '/reference/v1/': 'reference/',
  '/guides/v1/': 'guides/',
  '/models/v1/': 'models/',
  '/examples/v1/': 'examples/',
};

function getRelativePath(fromFile, toSection, toPath) {
  const fromDir = path.dirname(fromFile);
  const toFile = path.join(BASE_DIR, toSection, toPath);
  let relPath = path.relative(fromDir, toFile);
  relPath = relPath.replace(/\\/g, '/');
  if (relPath.endsWith('.mdx')) {
    relPath = relPath.slice(0, -4);
  }
  if (!relPath.startsWith('../')) {
    relPath = './' + relPath;
  }
  return relPath;
}

function convertLink(match, fullUrl, filePath) {
  if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
    return match;
  }

  let hashAnchor = '';
  let urlWithoutHash = fullUrl;
  if (fullUrl.includes('#')) {
    const parts = fullUrl.split('#');
    urlWithoutHash = parts[0];
    hashAnchor = '#' + parts[1];
  }

  for (const [urlPrefix, sectionDir] of Object.entries(URL_MAPPINGS)) {
    if (urlWithoutHash.startsWith(urlPrefix)) {
      const pathAfterPrefix = urlWithoutHash.slice(urlPrefix.length);
      const relPath = getRelativePath(filePath, sectionDir, pathAfterPrefix);
      return `](${relPath}${hashAnchor})`;
    }
  }

  return match;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = /\]\((\/(?:docs|reference|guides|models|examples)\/v1\/[^)]+)\)/g;
  const originalContent = content;
  const newContent = content.replace(pattern, (match, url) => {
    return convertLink(match, url, filePath);
  });

  if (newContent !== originalContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
  return false;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.mdx')) {
      callback(filePath);
    }
  }
}

function main() {
  let filesChanged = 0;
  let filesProcessed = 0;

  console.log('Processing reference directory...');

  walkDir(REFERENCE_DIR, (filePath) => {
    filesProcessed++;

    if (processFile(filePath)) {
      filesChanged++;
      const relPath = path.relative(REFERENCE_DIR, filePath);
      console.log(`✓ ${relPath}`);
    }
  });

  console.log(`\nProcessed ${filesProcessed} files, changed ${filesChanged} files`);
}

main();
