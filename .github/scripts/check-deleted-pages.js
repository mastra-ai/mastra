import { execSync } from 'child_process';
import fs from 'fs';

const matcherCache = new Map();
const BASE_REF = process.env.BASE_REF || 'origin/main';
const DOCS_DIR = 'docs/src/content';
const VERCEL_JSON_PATH = 'docs/vercel.json';

// Get list of deleted MDX files
function getDeletedMdxFiles() {
  try {
    const diff = execSync(`git diff --name-status ${BASE_REF}...HEAD -- ${DOCS_DIR}`, {
      encoding: 'utf-8',
    });

    const deletedFiles = diff
      .split('\n')
      .filter(line => line.startsWith('D\t') && line.endsWith('.mdx'))
      .map(line => line.replace('D\t', '').trim())
      .filter(file => file.length > 0);

    return deletedFiles;
  } catch (error) {
    console.error('Error getting deleted files:', error.message);
    return [];
  }
}

// Convert file path to URL path
function filePathToUrlPath(filePath) {
  // Remove docs/src/content/en/ prefix and .mdx suffix
  let urlPath = filePath.replace(/^docs\/src\/content\/en\//, '').replace(/\.mdx$/, '');

  // Handle index files (they should redirect to parent directory)
  if (urlPath.endsWith('/index')) {
    urlPath = urlPath.replace(/\/index$/, '');
  }

  // Add /v1 prefix for paths that use routeBasePath with /v1
  // (docs, models, guides, examples, reference all use /v1)
  const v1Paths = ['docs', 'models', 'guides', 'examples', 'reference'];
  for (const pathPrefix of v1Paths) {
    if (urlPath.startsWith(`${pathPrefix}/`)) {
      urlPath = urlPath.replace(new RegExp(`^${pathPrefix}/`), `${pathPrefix}/v1/`);
      break;
    }
  }

  // Add leading slash
  urlPath = '/' + urlPath;

  return urlPath;
}

// Load redirects from vercel.json
function getExistingRedirects() {
  try {
    const vercelJson = JSON.parse(fs.readFileSync(VERCEL_JSON_PATH, 'utf-8'));
    return vercelJson.redirects || [];
  } catch (error) {
    console.error('Error reading vercel.json:', error.message);
    return [];
  }
}

// Strip locale pattern from source for matching
function stripLocalePattern(source) {
  // Strip /:path(ja)? or /:locale(ja)? pattern from the beginning
  return source.replace(/^\/:[^/]+\([^)]+\)\?/, '');
}

// Convert path pattern to regex (handles :param, :param*, :param+, :param?)
function patternToRegex(pattern) {
  // First, escape standard special regex characters in the original pattern
  // This escapes literals like dots in '/api.v1/:id' before processing :id
  // We need to escape: . ^ $ { } | [ ] \ ( )
  // But NOT: : * ? + which we use for parameter operators
  let regexStr = pattern.replace(/[.^${}()|\[\]\\]/g, '\\$&');

  // Then escape *, ?, + only when they are literal (not part of :param operators)
  // Use negative lookbehind to ensure they're not preceded by a word char
  // This way ':param*' keeps the operator while literal '*' gets escaped
  regexStr = regexStr.replace(/(?<!\w)([?*+])/g, '\\$1');

  // Then convert path-to-regexp patterns to regex patterns
  // These replacements work on the escaped string, converting :param patterns
  regexStr = regexStr
    // Replace :param* with catch-all (.*)
    .replace(/:(\w+)\*/g, '(?<$1>.*)')
    // Replace :param+ with one or more segments ([^/]+(?:/[^/]+)*)
    .replace(/:(\w+)\+/g, '(?<$1>[^/]+(?:/[^/]+)*)')
    // Replace :param? with optional segment ([^/]*)
    .replace(/:(\w+)\?/g, '(?<$1>[^/]*)')
    // Replace :param with single segment ([^/]+)
    .replace(/:(\w+)/g, '(?<$1>[^/]+)');

  return new RegExp(`^${regexStr}$`);
}

// Check if a URL has a redirect
function hasRedirect(urlPath, redirects) {
  return redirects.some(({ source }) => {
    // Strip locale pattern for comparison
    const cleanSource = stripLocalePattern(source);

    // Exact match
    if (cleanSource === urlPath) {
      return true;
    }

    // Pattern match using regex
    try {
      if (!matcherCache.has(cleanSource)) {
        matcherCache.set(cleanSource, patternToRegex(cleanSource));
      }
      const regex = matcherCache.get(cleanSource);
      return regex.test(urlPath);
    } catch {
      return false;
    }
  });
}

// Main function
function main() {
  console.log('🔍 Checking for removed pages without redirects...\n');

  const deletedFiles = getDeletedMdxFiles();

  if (deletedFiles.length === 0) {
    console.log('✅ No MDX files were deleted in this PR.');
    process.exit(0);
  }

  console.log(`Found ${deletedFiles.length} deleted MDX file(s):\n`);
  deletedFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');

  const redirects = getExistingRedirects();
  console.log(`Found ${redirects.length} redirects in vercel.json\n`);

  const missingRedirects = [];

  for (const filePath of deletedFiles) {
    const urlPath = filePathToUrlPath(filePath);

    if (!hasRedirect(urlPath, redirects)) {
      missingRedirects.push({ filePath, urlPath });
    }
  }

  if (missingRedirects.length === 0) {
    console.log('✅ All deleted pages have redirects!');
    process.exit(0);
  }

  console.log('❌ Missing redirects for the following pages:\n');
  missingRedirects.forEach(({ filePath, urlPath }) => {
    console.log(`  File: ${filePath}`);
    console.log(`  URL:  ${urlPath}`);
    console.log('');
  });

  console.log('Please add redirects for these pages to docs/vercel.json\n');

  // Save missing redirects for GitHub Action to use
  const output = missingRedirects.map(m => m.urlPath);
  fs.writeFileSync('/tmp/missing-redirects.json', JSON.stringify(output, null, 2));

  process.exit(1);
}

main();
