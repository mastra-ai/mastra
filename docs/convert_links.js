const fs = require('fs');
const path = require('path');

const BASE_DIR = '/Users/booker/Code/mastra/docs/src/content/en';
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
  // Get the directory containing the source file
  const fromDir = path.dirname(fromFile);

  // Build the target absolute path
  const toFile = path.join(BASE_DIR, toSection, toPath);

  // Calculate relative path
  let relPath = path.relative(fromDir, toFile);

  // Convert to forward slashes
  relPath = relPath.replace(/\\/g, '/');

  // Remove .mdx extension if present
  if (relPath.endsWith('.mdx')) {
    relPath = relPath.slice(0, -4);
  }

  // Ensure path starts with ./ if it doesn't start with ../
  if (!relPath.startsWith('../')) {
    relPath = './' + relPath;
  }

  return relPath;
}

function convertLink(match, fullUrl, filePath) {
  // Check if it's an external URL
  if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
    return match;
  }

  // Extract hash anchor if present
  let hashAnchor = '';
  let urlWithoutHash = fullUrl;
  if (fullUrl.includes('#')) {
    const parts = fullUrl.split('#');
    urlWithoutHash = parts[0];
    hashAnchor = '#' + parts[1];
  }

  // Try to match the URL pattern
  for (const [urlPrefix, sectionDir] of Object.entries(URL_MAPPINGS)) {
    if (urlWithoutHash.startsWith(urlPrefix)) {
      // Extract the path after the prefix
      const pathAfterPrefix = urlWithoutHash.slice(urlPrefix.length);

      // Calculate relative path
      const relPath = getRelativePath(filePath, sectionDir, pathAfterPrefix);

      // Return the converted link
      return `](${relPath}${hashAnchor})`;
    }
  }

  // If no match found, return original
  return match;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Pattern to match markdown links: ](URL)
  const pattern = /\]\((\/(?:docs|reference|guides|models|examples)\/v1\/[^)]+)\)/g;

  const originalContent = content;
  const newContent = content.replace(pattern, (match, url) => {
    return convertLink(match, url, filePath);
  });

  // Only write if content changed
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

  walkDir(REFERENCE_DIR, (filePath) => {
    filesProcessed++;

    if (processFile(filePath)) {
      filesChanged++;
      console.log(`✓ ${path.relative(REFERENCE_DIR, filePath)}`);
    }
  });

  console.log(`\nProcessed ${filesProcessed} files, changed ${filesChanged} files`);
}

main();
