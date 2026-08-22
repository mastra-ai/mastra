#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = path.resolve(here, '..');

const SOURCE_FILES = ['src/mastra/index.ts', '.env.schema', 'docker-compose.yml'];
const EXTRA_RUNTIME_DEPENDENCIES = ['@mastra/memory', 'zod'];
const TOOL_DEPENDENCIES = ['@types/node', 'mastra', 'varlock'];
const ALLOWED_BUILTINS = new Set(['node:os', 'node:path']);

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`generate-scaffold: missing ${label}: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`generate-scaffold: invalid JSON in ${label} ${filePath}: ${error.message}`);
  }
}

function packageNameFromSpecifier(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

export function extractRuntimeDependencies(source) {
  const dependencies = new Set();
  const importPattern = /(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
    if (specifier.startsWith('node:')) {
      if (!ALLOWED_BUILTINS.has(specifier)) {
        throw new Error(`generate-scaffold: unmapped Node.js import ${specifier}`);
      }
      continue;
    }
    const packageName = packageNameFromSpecifier(specifier);
    if (packageName !== 'mastra' && !packageName.startsWith('@mastra/')) {
      throw new Error(`generate-scaffold: unmapped package import ${specifier}`);
    }
    dependencies.add(packageName);
  }
  for (const dependency of EXTRA_RUNTIME_DEPENDENCIES) dependencies.add(dependency);
  return [...dependencies].sort();
}

function parseVersion(version, packageName) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new Error(`generate-scaffold: ${packageName} has invalid version ${version}`);
  return { version, prerelease: match[4], channel: match[4]?.split('.')[0] };
}

export function dependencyVersionSpec(packageName, dependencyVersion, createFactoryVersion) {
  const dependency = parseVersion(dependencyVersion, packageName);
  const release = parseVersion(createFactoryVersion, 'create-factory');
  if (!release.prerelease && dependency.prerelease) {
    throw new Error(
      `generate-scaffold: stable create-factory@${release.version} cannot include prerelease ${packageName}@${dependency.version}`,
    );
  }
  if (release.prerelease && dependency.prerelease && dependency.channel !== release.channel) {
    throw new Error(
      `generate-scaffold: prerelease channel mismatch: create-factory@${release.version} and ${packageName}@${dependency.version}`,
    );
  }
  return dependency.prerelease ? dependency.version : `^${dependency.version}`;
}

function dependencySourceSpec(webManifest, packageName) {
  const spec = webManifest.dependencies?.[packageName] ?? webManifest.devDependencies?.[packageName];
  if (!spec) {
    throw new Error(`generate-scaffold: mastracode/web is missing required dependency ${packageName}`);
  }
  return spec;
}

function resolveWorkspaceVersion({ packageName, sourceSpec, webRoot, monorepoRoot }) {
  if (!sourceSpec.startsWith('link:') && !sourceSpec.startsWith('workspace:')) {
    return null;
  }
  if (sourceSpec.startsWith('workspace:')) {
    throw new Error(
      `generate-scaffold: cannot resolve workspace spec ${packageName}@${sourceSpec} without a linked path`,
    );
  }
  const packageRoot = path.resolve(webRoot, sourceSpec.slice('link:'.length));
  const relative = path.relative(monorepoRoot, packageRoot);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`generate-scaffold: ${packageName} link resolves outside the monorepo: ${packageRoot}`);
  }
  const manifestPath = path.join(packageRoot, 'package.json');
  const manifest = readJson(manifestPath, `${packageName} workspace manifest`);
  if (manifest.name !== packageName) {
    throw new Error(`generate-scaffold: ${manifestPath} is named ${manifest.name}, expected ${packageName}`);
  }
  return manifest.version;
}

function resolveDependencySpec({ packageName, webManifest, webRoot, monorepoRoot, createFactoryVersion }) {
  const sourceSpec = dependencySourceSpec(webManifest, packageName);
  const workspaceVersion = resolveWorkspaceVersion({ packageName, sourceSpec, webRoot, monorepoRoot });
  if (packageName === 'mastra' || packageName.startsWith('@mastra/')) {
    if (!workspaceVersion) {
      throw new Error(`generate-scaffold: ${packageName} must resolve from a workspace package manifest`);
    }
    return dependencyVersionSpec(packageName, workspaceVersion, createFactoryVersion);
  }
  return workspaceVersion ? dependencyVersionSpec(packageName, workspaceVersion, createFactoryVersion) : sourceSpec;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function envExampleFromSchema(schema) {
  const output = [];
  let inHeader = true;
  for (const line of schema.split('\n')) {
    if (inHeader) {
      if (line.trim() === '# ---') inHeader = false;
      continue;
    }
    if (/^\s*#\s*@/.test(line)) continue;
    output.push(/^[A-Z][A-Z0-9_]*=\s*$/.test(line) ? `# ${line.trim()}` : line);
  }
  const body = output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart();
  return `# Mastra Factory environment.\n# Copied to .env by \`npm create factory\`; every value is optional —\n# features light up as their variables are set (see README.md).\n# Validation source of truth: .env.schema (varlock).\n\n${body}`;
}

export function generateScaffold(options = {}) {
  const packageRoot = path.resolve(options.packageRoot ?? defaultPackageRoot);
  const monorepoRoot = path.resolve(options.monorepoRoot ?? path.resolve(packageRoot, '../..'));
  const webRoot = path.resolve(options.webRoot ?? path.join(monorepoRoot, 'mastracode/web'));
  const outputDir = path.resolve(
    options.outputDir ?? path.join(packageRoot, 'src/commands/factory/generated/scaffold'),
  );
  const packageManifest = readJson(path.join(packageRoot, 'package.json'), 'mastra CLI manifest');
  const webManifest = readJson(path.join(webRoot, 'package.json'), 'mastracode/web manifest');
  const readmePath = path.join(packageRoot, 'scripts/factory-scaffold-readme.md');
  if (!fs.existsSync(readmePath)) throw new Error(`generate-scaffold: missing README template: ${readmePath}`);

  const sourcePaths = new Map();
  for (const relativePath of SOURCE_FILES) {
    const sourcePath = path.join(webRoot, relativePath);
    if (!fs.existsSync(sourcePath)) throw new Error(`generate-scaffold: missing source file: ${sourcePath}`);
    sourcePaths.set(relativePath, sourcePath);
  }

  const entrySource = fs.readFileSync(sourcePaths.get('src/mastra/index.ts'), 'utf8');
  const runtimeDependencies = extractRuntimeDependencies(entrySource);
  const dependencies = {};
  for (const packageName of runtimeDependencies) {
    if (packageName === '@mastra/memory') {
      const memoryManifest = readJson(
        path.join(monorepoRoot, 'packages/memory/package.json'),
        '@mastra/memory manifest',
      );
      if (memoryManifest.name !== packageName)
        throw new Error('generate-scaffold: packages/memory has unexpected package name');
      dependencies[packageName] = dependencyVersionSpec(packageName, memoryManifest.version, packageManifest.version);
      continue;
    }
    dependencies[packageName] = resolveDependencySpec({
      packageName,
      webManifest,
      webRoot,
      monorepoRoot,
      createFactoryVersion: packageManifest.version,
    });
  }

  const devDependencies = {};
  for (const packageName of TOOL_DEPENDENCIES) {
    devDependencies[packageName] = resolveDependencySpec({
      packageName,
      webManifest,
      webRoot,
      monorepoRoot,
      createFactoryVersion: packageManifest.version,
    });
  }
  devDependencies.typescript = '^5.9.2';

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [relativePath, sourcePath] of sourcePaths) {
    const destination = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(sourcePath, destination);
  }

  writeJson(path.join(outputDir, 'package.json'), {
    name: 'mastra-factory',
    version: '0.1.0',
    description:
      'Mastra Factory: an agent-powered software delivery environment. Intake GitHub/Linear issues, work them with coding agents, and ship pull requests — all from your own deployable web app.',
    private: true,
    type: 'module',
    license: 'Apache-2.0',
    scripts: {
      dev: 'mastra factory dev --dir src/mastra',
      'db:up': 'docker compose up -d --wait',
      'db:down': 'docker compose down',
      check: 'tsc --noEmit',
      build: 'mastra build --dir src/mastra',
      start: 'varlock run -- mastra start',
      deploy: 'mastra deploy',
    },
    dependencies,
    devDependencies,
    engines: webManifest.engines,
  });

  writeJson(path.join(outputDir, 'tsconfig.json'), {
    compilerOptions: {
      esModuleInterop: true,
      skipLibCheck: true,
      target: 'es2022',
      allowJs: true,
      resolveJsonModule: true,
      moduleDetection: 'force',
      isolatedModules: true,
      verbatimModuleSyntax: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      declaration: true,
      declarationMap: true,
      module: 'Preserve',
      noEmit: true,
      lib: ['ES2023'],
      types: ['node'],
    },
    include: ['src/**/*'],
    exclude: ['node_modules'],
  });
  fs.writeFileSync(
    path.join(outputDir, '.env.example'),
    envExampleFromSchema(fs.readFileSync(sourcePaths.get('.env.schema'), 'utf8')),
  );
  fs.writeFileSync(
    path.join(outputDir, 'gitignore'),
    'node_modules/\n.env\n.env.*\n!.env.example\n!.env.schema\n.mastra/\n*.log\n.DS_Store\n',
  );
  const usesPrereleaseVersions = [...Object.values(dependencies), ...Object.values(devDependencies)].some(spec =>
    /^\d+\.\d+\.\d+-/.test(spec),
  );
  if (usesPrereleaseVersions) {
    // npm excludes nested .npmrc files from package tarballs, so stage it without the dot.
    fs.writeFileSync(path.join(outputDir, 'npmrc'), 'legacy-peer-deps=true\n');
  }
  fs.writeFileSync(
    path.join(outputDir, 'pnpm-workspace.yaml'),
    `# pnpm configuration for Mastra Factory.\nminimumReleaseAgeExclude:\n  - '@mastra/*'\n  - mastra\nallowBuilds:\n  '@google/genai': true\n  agent-browser: true\n  bufferutil: true\n  edgedriver: false\n  esbuild: true\n  geckodriver: false\n  onnxruntime-node: true\n  protobufjs: true\n  utf-8-validate: true\n`,
  );
  fs.copyFileSync(readmePath, path.join(outputDir, 'README.md'));
  return { outputDir, manifest: JSON.parse(fs.readFileSync(path.join(outputDir, 'package.json'), 'utf8')) };
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`generate-scaffold: ${flag} requires a value`);
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const result = generateScaffold({ outputDir: argValue(args, '--out') });
    console.log(`generate-scaffold: wrote ${result.outputDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
