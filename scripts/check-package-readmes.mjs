#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Keep these prefixes synchronized with .github/scripts/validate-pkg-json.mjs.
export const IGNORE_LIST = [
  '@internal',
  '@mastra/memory-integration-tests',
  '@mastra/longmemeval',
  '@mastra/mcp-configuration',
  'mastra-docs',
  '@mastra/core',
  '@mastra/codemod',
  'create-mastra',
];
export const ALLOW_LIST = ['mastra', 'create-mastra', '@mastra'];

export const REQUIRED_SECTIONS = ['Installation', 'Usage', 'Documentation', 'Changelog', 'Support'];
export const SUPPORT_TEXT =
  'We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.';

const DOCS_ROOTS = {
  docs: 'docs/src/content/en/docs',
  integrations: 'docs/src/content/en/integrations',
  models: 'docs/src/content/en/models',
  reference: 'docs/src/content/en/reference',
};

export function shouldCheckPackage(pkg) {
  if (pkg.private === true || !pkg.name) return false;
  if (IGNORE_LIST.some(prefix => pkg.name.startsWith(prefix))) return false;
  return ALLOW_LIST.some(prefix => pkg.name.startsWith(prefix));
}

function walkFiles(directory, filePattern, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, filePattern, files);
    } else if (
      entry.isFile() &&
      (filePattern.startsWith('.') ? entry.name.endsWith(filePattern) : entry.name === filePattern)
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

export function discoverPackages(rootDir) {
  const rootPackageJson = path.join(rootDir, 'package.json');

  return walkFiles(rootDir, 'package.json')
    .filter(packageJsonPath => packageJsonPath !== rootPackageJson)
    .map(packageJsonPath => ({
      packageJsonPath,
      packageJson: JSON.parse(readFileSync(packageJsonPath, 'utf8')),
    }))
    .filter(({ packageJson }) => shouldCheckPackage(packageJson))
    .map(({ packageJsonPath, packageJson }) => ({
      directory: path.dirname(packageJsonPath),
      name: packageJson.name,
      packageJsonPath,
      relativeDirectory: toPosixPath(path.relative(rootDir, path.dirname(packageJsonPath))),
    }))
    .sort((left, right) => left.relativeDirectory.localeCompare(right.relativeDirectory));
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function normalizeRoute(route) {
  const normalized = `/${route}`.replaceAll(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

function readFrontmatter(content) {
  return content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
}

function readScalarSlug(content) {
  const frontmatter = readFrontmatter(content);
  if (!frontmatter) return undefined;

  const match = frontmatter.match(/^slug:\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^#\r\n]+?))\s*$/m);
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim();
}

function readFrontmatterPackages(content) {
  const frontmatter = readFrontmatter(content);
  const packagesBlock = frontmatter?.match(/^packages:\s*\r?\n((?:\s+-\s+[^\r\n]+\r?\n?)*)/m)?.[1] ?? '';
  return new Set(
    [...packagesBlock.matchAll(/^\s+-\s+(?:"([^"]+)"|'([^']+)'|([^#\r\n]+?))\s*$/gm)].map(match =>
      (match[1] ?? match[2] ?? match[3]).trim(),
    ),
  );
}

export function buildDocsRouteSet(rootDir) {
  const routes = new Map();

  for (const [routeBase, relativeContentRoot] of Object.entries(DOCS_ROOTS)) {
    const contentRoot = path.join(rootDir, relativeContentRoot);
    if (!existsSync(contentRoot)) continue;

    for (const sourcePath of walkFiles(contentRoot, '.mdx')) {
      const content = readFileSync(sourcePath, 'utf8');
      const packages = readFrontmatterPackages(content);
      const relativeSource = toPosixPath(path.relative(contentRoot, sourcePath));
      const withoutExtension = relativeSource.replace(/\.mdx$/, '');
      const defaultRelativeRoute = withoutExtension.endsWith('/index')
        ? withoutExtension.slice(0, -'/index'.length)
        : withoutExtension === 'index'
          ? ''
          : withoutExtension;
      const defaultRoute = normalizeRoute(`${routeBase}/${defaultRelativeRoute}`);
      routes.set(defaultRoute, packages);
      routes.set(`${defaultRoute}.mdx`, packages);

      const slug = readScalarSlug(content);
      if (slug === undefined) continue;

      const sourceDirectory = path.posix.dirname(withoutExtension);
      const slugRoute = slug.startsWith('/')
        ? normalizeRoute(`${routeBase}/${slug}`)
        : normalizeRoute(`${routeBase}/${sourceDirectory === '.' ? '' : sourceDirectory}/${slug}`);
      routes.set(slugRoute, packages);
      routes.set(`${slugRoute}.mdx`, packages);
    }
  }

  return routes;
}

function stripFencedCode(content) {
  const output = [];
  let fence;

  for (const line of content.split(/\r?\n/)) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker && !fence) {
      fence = marker[0];
      continue;
    }
    if (marker && fence === marker[0]) {
      fence = undefined;
      continue;
    }
    if (!fence) output.push(line);
  }

  return output.join('\n');
}

export function extractLinks(content) {
  const withoutFences = stripFencedCode(content);
  const withoutImages = withoutFences.replace(/!\[[^\]]*\]\((?:<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g, '');
  const links = new Set();

  for (const match of withoutImages.matchAll(/(?<!!)\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g)) {
    links.add(match[1] ?? match[2]);
  }
  for (const match of withoutImages.matchAll(/<(https?:\/\/[^>\s]+)>/g)) {
    links.add(match[1]);
  }
  for (const match of withoutImages.matchAll(/https?:\/\/[^\s<>)\]]+/g)) {
    links.add(match[0].replace(/[.,;:]+$/, ''));
  }

  return [...links];
}

function getMastraDocsRoute(sourceUrl) {
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    return undefined;
  }

  if (url.hostname !== 'mastra.ai') return undefined;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (!/^\/(docs|integrations|models|reference)(?:\/|$)/.test(pathname)) return undefined;
  return normalizeRoute(pathname);
}

export function isResolvedMastraDocsLink(sourceUrl, docsRoutes) {
  const route = getMastraDocsRoute(sourceUrl);
  return route === undefined || (route !== null && docsRoutes.has(route));
}

// Reject demonstrated no-op shapes without attempting to interpret arbitrary TypeScript examples.
function hasDegenerateUsageExample(usage) {
  if (/Object\.(?:keys|values|entries)\(\s*\w+\s*\)/.test(usage)) return true;

  const codeBlocks = [...usage.matchAll(/```[^\r\n]*\r?\n([\s\S]*?)```/g)].map(match => match[1]);
  return (
    codeBlocks.length > 0 &&
    codeBlocks.every(code => {
      const executableLines = code
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && !line.startsWith('import '));

      return (
        executableLines.length === 0 ||
        (executableLines.length === 1 &&
          /^(?:export\s+)?const\s+\w+\s*=\s*[A-Z][\w$]*(?:\.[A-Za-z_$][\w$]*)?\s*;?$/.test(executableLines[0]))
      );
    })
  );
}

function maskFencedCode(content) {
  let fence;
  return content.replace(/[^\r\n]*(?:\r?\n|$)/g, line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    const isFenceLine = marker && (!fence || marker[0] === fence);
    if (isFenceLine) fence = fence ? undefined : marker[0];
    return fence || isFenceLine ? line.replace(/[^\r\n]/g, ' ') : line;
  });
}

function parseSections(content) {
  const headingContent = maskFencedCode(content);
  const headings = [...headingContent.matchAll(/^(#{1,2})[ \t]+(.+?)[ \t]*#*[ \t]*\r?$/gm)].map(match => ({
    level: match[1].length,
    name: match[2].trim(),
    start: match.index,
    contentStart: match.index + match[0].length,
  }));
  const h1Headings = headings.filter(heading => heading.level === 1);
  const h2Headings = headings.filter(heading => heading.level === 2);
  const sections = new Map();

  for (let index = 0; index < h2Headings.length; index += 1) {
    const heading = h2Headings[index];
    sections.set(
      heading.name,
      content.slice(heading.contentStart, h2Headings[index + 1]?.start ?? content.length).trim(),
    );
  }

  return { h1Headings, h2Headings, sections };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function validateReadme({ content, name, relativeDirectory, docsRoutes }) {
  const errors = [];
  const { h1Headings, h2Headings, sections } = parseSections(content);

  if (h1Headings.length !== 1 || !h1Headings[0]?.name) {
    errors.push('expected exactly one non-empty H1 package title');
  }

  const actualSections = h2Headings.map(heading => heading.name);
  if (actualSections.join('\n') !== REQUIRED_SECTIONS.join('\n')) {
    errors.push(`expected H2 sections in this exact order: ${REQUIRED_SECTIONS.join(', ')}`);
  }

  for (const sectionName of REQUIRED_SECTIONS) {
    if (!sections.get(sectionName)?.trim()) {
      errors.push(`${sectionName} section is empty or missing`);
    }
  }

  const installation = sections.get('Installation') ?? '';
  const installCommand = new RegExp(`^\\s*npm install ${escapeRegExp(name)}\\s*$`, 'm');
  if (!installCommand.test(installation)) {
    errors.push(`Installation section must contain the exact command: npm install ${name}`);
  }

  const usage = sections.get('Usage') ?? '';
  if (usage.includes('Configure the prerequisites described in the documentation.')) {
    errors.push('Usage section must state concrete prerequisites or omit the prerequisite preamble');
  }
  if (hasDegenerateUsageExample(usage)) {
    errors.push('Usage section must contain a functional package example, not export introspection or a symbol alias');
  }

  const changelogUrl = `https://github.com/mastra-ai/mastra/blob/main/${relativeDirectory}/CHANGELOG.md`;
  if (!(sections.get('Changelog') ?? '').includes(changelogUrl)) {
    errors.push(`Changelog section must link to ${changelogUrl}`);
  }

  if (normalizeWhitespace(sections.get('Support') ?? '') !== normalizeWhitespace(SUPPORT_TEXT)) {
    errors.push('Support section must contain the standard Discord support paragraph');
  }

  for (const link of extractLinks(content).sort()) {
    if (!isResolvedMastraDocsLink(link, docsRoutes)) {
      errors.push(`unresolved Mastra docs link: ${link}`);
      continue;
    }

    const route = getMastraDocsRoute(link);
    const documentedPackages = route && route.startsWith('/integrations/') ? docsRoutes.get(route) : undefined;
    if (documentedPackages?.size && !documentedPackages.has(name)) {
      errors.push(`Mastra integration docs link does not document ${name}: ${link}`);
    }
  }

  return errors;
}

function selectPackages(packages, rootDir, arguments_) {
  if (arguments_.length === 0) return packages;

  const selections = arguments_.map(argument => {
    const absolutePath = path.resolve(rootDir, argument);
    return ['README.md', 'package.json'].includes(path.basename(absolutePath))
      ? path.dirname(absolutePath)
      : absolutePath;
  });

  return packages.filter(packageInfo =>
    selections.some(
      selection => packageInfo.directory === selection || packageInfo.directory.startsWith(`${selection}${path.sep}`),
    ),
  );
}

function printErrorGroups(errorGroups) {
  console.error('Package README validation failed:');
  for (const [readmePath, errors] of errorGroups) {
    console.error(`\n${readmePath}:`);
    for (const error of errors) console.error(`  - ${error}`);
  }
}

export function runCli({ rootDir = process.cwd(), arguments_ = process.argv.slice(2) } = {}) {
  const printReadmePaths = arguments_.includes('--print-readme-paths');
  const selectionArguments = arguments_.filter(argument => argument !== '--print-readme-paths');
  const allPackages = discoverPackages(rootDir);
  const packages = selectPackages(allPackages, rootDir, selectionArguments);

  if (selectionArguments.length > 0 && packages.length === 0) {
    console.error(`No eligible packages selected by: ${selectionArguments.join(', ')}`);
    return 1;
  }

  const missingReadmes = packages.filter(packageInfo => !existsSync(path.join(packageInfo.directory, 'README.md')));
  if (printReadmePaths) {
    if (missingReadmes.length > 0) {
      for (const packageInfo of missingReadmes) {
        console.error(`${packageInfo.relativeDirectory}: missing README`);
      }
      return 1;
    }

    for (const packageInfo of packages) {
      console.log(`${packageInfo.relativeDirectory}/README.md`);
    }
    return 0;
  }

  const docsRoutes = buildDocsRouteSet(rootDir);
  const errorGroups = new Map();

  for (const packageInfo of packages) {
    const readmePath = path.join(packageInfo.directory, 'README.md');
    const changelogPath = path.join(packageInfo.directory, 'CHANGELOG.md');
    const relativeReadmePath = `${packageInfo.relativeDirectory}/README.md`;
    const errors = [];

    if (!existsSync(readmePath)) {
      errors.push(`${packageInfo.relativeDirectory}: missing README`);
    } else {
      errors.push(
        ...validateReadme({
          content: readFileSync(readmePath, 'utf8'),
          name: packageInfo.name,
          relativeDirectory: packageInfo.relativeDirectory,
          docsRoutes,
        }),
      );
    }

    if (!existsSync(changelogPath)) {
      errors.push(`${packageInfo.relativeDirectory}: missing CHANGELOG`);
    }

    if (errors.length > 0) errorGroups.set(relativeReadmePath, errors);
  }

  console.log(`Eligible packages: ${packages.length}`);
  if (errorGroups.size > 0) {
    printErrorGroups(errorGroups);
    return 1;
  }

  console.log(`All ${packages.length} eligible package READMEs passed validation.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runCli();
}
