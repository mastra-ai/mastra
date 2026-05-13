import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const PACKAGE_ROOTS = [
  'auth',
  'browser',
  'channels',
  'client-sdks',
  'deployers',
  'integrations',
  'observability',
  'packages',
  'pubsub',
  'server-adapters',
  'stores',
  'voice',
  'workflows',
  'workspaces',
];

const GENERATED_EXPORT_EXCEPTIONS = {
  // These package exports point at artifact entries that do not have checked-in source entrypoints.
  // Keep exceptions explicit and documented; do not use this for ordinary src-backed exports.
  '@mastra/core ./network/vNext':
    'legacy export retained for built artifacts; no checked-in src/network/vNext entrypoint exists',
  '@mastra/core ./telemetry/otel-vendor':
    'vendor bundle export is generated for built artifacts; no checked-in source entrypoint exists',
};

const SOURCE_TARGET_OVERRIDES = {
  '@internal/core ./storage': './src/storage/index.ts',
  '@mastra/playground-ui .': './src/index.ts',
  '@mastra/playground-ui ./tokens': './src/ds/tokens/index.ts',
  '@mastra/playground-ui ./utils': './src/utils.ts',
  '@mastra/server ./handlers/*': './src/server/handlers/*.ts',
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function packageManifestPaths() {
  const paths = [];

  for (const rootName of PACKAGE_ROOTS) {
    const root = join(ROOT, rootName);
    if (!existsSync(root)) continue;

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(root, entry.name, 'package.json');
      if (existsSync(manifestPath)) paths.push(manifestPath);
    }
  }

  return paths.sort((a, b) => relative(ROOT, a).localeCompare(relative(ROOT, b)));
}

function artifactTarget(exportValue) {
  if (!exportValue || typeof exportValue !== 'object' || Array.isArray(exportValue)) return undefined;

  const importCondition = exportValue.import;
  if (typeof importCondition === 'string') return importCondition;
  if (importCondition && typeof importCondition === 'object' && typeof importCondition.default === 'string') {
    return importCondition.default;
  }

  return undefined;
}

function sourceTargetFor(packageName, exportPath, artifact) {
  const override = SOURCE_TARGET_OVERRIDES[`${packageName} ${exportPath}`];
  if (override) return override;
  if (!artifact?.startsWith('./dist/') || !artifact.endsWith('.js')) return undefined;

  const withoutPrefix = artifact.slice('./dist/'.length, -'.js'.length);
  if (withoutPrefix === 'index') return './src/index.ts';
  if (withoutPrefix.endsWith('/index')) return `./src/${withoutPrefix}.ts`;
  return `./src/${withoutPrefix}.ts`;
}

function sourceExists(packageDir, sourceTarget) {
  if (!sourceTarget) return false;
  if (!sourceTarget.includes('*')) return existsSync(join(packageDir, sourceTarget));

  const [prefix, suffix] = sourceTarget.split('*');
  const prefixWithoutTrailingSlash = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const directory = prefix.endsWith('/')
    ? join(packageDir, prefixWithoutTrailingSlash)
    : dirname(join(packageDir, prefix));
  const basenamePrefix = prefix.endsWith('/') ? '' : join(packageDir, prefix).slice(directory.length + 1);
  if (!existsSync(directory)) return false;

  return readdirSync(directory).some(entry => entry.startsWith(basenamePrefix) && entry.endsWith(suffix));
}

function reorderExport(exportValue, sourceTarget) {
  const next = {};
  next['mastra-source'] = sourceTarget;

  for (const [key, value] of Object.entries(exportValue)) {
    if (key === 'mastra-source') continue;
    next[key] = value;
  }

  return next;
}

function syncManifest(manifestPath) {
  const pkg = readJson(manifestPath);
  if (!pkg.exports || typeof pkg.exports !== 'object' || Array.isArray(pkg.exports)) {
    return { changed: false, skipped: [] };
  }

  const packageDir = dirname(manifestPath);
  const skipped = [];
  let changed = false;

  for (const [exportPath, exportValue] of Object.entries(pkg.exports)) {
    if (!exportValue || typeof exportValue !== 'object' || Array.isArray(exportValue)) continue;

    const artifact = artifactTarget(exportValue);
    const sourceTarget = sourceTargetFor(pkg.name, exportPath, artifact);
    if (!sourceTarget) continue;

    const exceptionKey = `${pkg.name} ${exportPath}`;
    if (GENERATED_EXPORT_EXCEPTIONS[exceptionKey]) continue;
    if (!sourceExists(packageDir, sourceTarget)) {
      skipped.push({ packageName: pkg.name, exportPath, sourceTarget, exceptionKey });
      continue;
    }

    if (exportValue['mastra-source'] !== sourceTarget || Object.keys(exportValue)[0] !== 'mastra-source') {
      pkg.exports[exportPath] = reorderExport(exportValue, sourceTarget);
      changed = true;
    }
  }

  if (changed) writeJson(manifestPath, pkg);

  return { changed, skipped };
}

function validateManifest(manifestPath) {
  const pkg = readJson(manifestPath);
  if (!pkg.exports || typeof pkg.exports !== 'object' || Array.isArray(pkg.exports)) return [];

  const packageDir = dirname(manifestPath);
  const errors = [];

  for (const [exportPath, exportValue] of Object.entries(pkg.exports)) {
    if (!exportValue || typeof exportValue !== 'object' || Array.isArray(exportValue)) continue;

    const artifact = artifactTarget(exportValue);
    const sourceTarget = sourceTargetFor(pkg.name, exportPath, artifact);
    if (!sourceTarget) continue;

    const exceptionKey = `${pkg.name} ${exportPath}`;
    const exceptionReason = GENERATED_EXPORT_EXCEPTIONS[exceptionKey];
    if (exceptionReason) continue;

    if (exportValue['mastra-source'] !== sourceTarget) {
      errors.push(`${relative(ROOT, manifestPath)} export ${exportPath} should have mastra-source ${sourceTarget}`);
      continue;
    }

    if (!sourceExists(packageDir, sourceTarget)) {
      errors.push(
        `${relative(ROOT, manifestPath)} export ${exportPath} points mastra-source to missing file ${sourceTarget}`,
      );
    }
  }

  return errors;
}

function sync() {
  const skipped = [];
  const changed = [];

  for (const manifestPath of packageManifestPaths()) {
    const result = syncManifest(manifestPath);
    if (result.changed) changed.push(relative(ROOT, manifestPath));
    skipped.push(...result.skipped);
  }

  for (const path of changed) console.log(`updated ${path}`);

  if (skipped.length > 0) {
    console.log('\nSkipped exports with no matching source file:');
    for (const item of skipped) {
      console.log(`- ${item.exceptionKey} -> ${item.sourceTarget}`);
    }
  }
}

function check() {
  const errors = packageManifestPaths().flatMap(validateManifest);

  if (errors.length > 0) {
    console.error('Source export validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Source export validation passed.');
}

const command = process.argv[2];

if (command === 'sync') {
  sync();
} else if (command === 'check') {
  check();
} else {
  console.error('Usage: node scripts/source-exports.mjs <sync|check>');
  process.exit(1);
}
