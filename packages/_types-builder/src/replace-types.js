// Typescript tooling really sucks so we are going to do some transfomrations ourselves
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, relative, resolve, extname, sep } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { getPackageInfo } from 'local-pkg';
import { pathToFileURL } from 'node:url';
import { exports as resolveExports } from 'resolve.exports';

function getPackageName(moduleSpecifier) {
  if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
    return null;
  }

  if (moduleSpecifier.startsWith('@')) {
    return moduleSpecifier.split('/').slice(0, 2).join('/');
  }

  return moduleSpecifier.split('/')[0];
}

function getTypesPackageName(packageName) {
  if (packageName.startsWith('@')) {
    return `@types/${packageName.slice(1).replace('/', '__')}`;
  }

  return `@types/${packageName}`;
}

function matchesBundledPackage(moduleSpecifier, bundledPackage) {
  const packageName = getPackageName(moduleSpecifier);
  if (!packageName) {
    return false;
  }

  if (bundledPackage.endsWith('/*')) {
    return packageName.startsWith(bundledPackage.slice(0, -1));
  }

  return packageName === bundledPackage || getTypesPackageName(packageName) === bundledPackage;
}

async function getPackageRootPath(packageName, parentPath) {
  let rootPath;

  try {
    let options;
    if (parentPath) {
      if (!parentPath.startsWith('file://')) {
        parentPath = pathToFileURL(extname(parentPath) ? dirname(parentPath) : parentPath).href;
      }

      options = {
        paths: [parentPath],
      };
    }

    const pkg = await getPackageInfo(packageName, options);
    rootPath = pkg?.rootPath ?? null;
  } catch {
    rootPath = null;
  }

  return rootPath;
}

async function pathExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function getModuleSpecifiers(sourceFile) {
  const moduleSpecifiers = [];

  sourceFile.getStatements().forEach(statement => {
    if (statement.getKind() === SyntaxKind.ImportDeclaration) {
      moduleSpecifiers.push(/** @type {import('ts-morph').ImportDeclaration} */ (statement).getModuleSpecifier());
    }

    if (statement.getKind() === SyntaxKind.ExportDeclaration) {
      const moduleSpecifier = /** @type {import('ts-morph').ExportDeclaration} */ (statement).getModuleSpecifier();
      if (moduleSpecifier) {
        moduleSpecifiers.push(moduleSpecifier);
      }
    }
  });

  sourceFile.getDescendantsOfKind(SyntaxKind.ImportType).forEach(importType => {
    const arg = importType.getArgument();
    if (arg.getKind() === SyntaxKind.LiteralType) {
      moduleSpecifiers.push(/** @type {import('ts-morph').LiteralTypeNode} */ (arg).getLiteral());
    }
  });

  return moduleSpecifiers;
}

async function resolveRelativeDeclaration(moduleSpecifier, fromFile) {
  if (!(moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../'))) {
    return null;
  }

  const resolvedSpecifier = resolve(dirname(fromFile), moduleSpecifier);
  const candidates = [];

  if (moduleSpecifier.endsWith('.d.ts') || moduleSpecifier.endsWith('.d.cts') || moduleSpecifier.endsWith('.d.mts')) {
    candidates.push(resolvedSpecifier);
  } else if (moduleSpecifier.endsWith('.js') || moduleSpecifier.endsWith('.mjs') || moduleSpecifier.endsWith('.cjs')) {
    candidates.push(resolvedSpecifier.replace(/\.(mjs|cjs|js)$/, '.d.ts'));
    candidates.push(resolvedSpecifier.replace(/\.(mjs|cjs|js)$/, '.d.mts'));
    candidates.push(resolvedSpecifier.replace(/\.(mjs|cjs|js)$/, '.d.cts'));
  } else if (extname(moduleSpecifier)) {
    candidates.push(resolvedSpecifier);
  } else {
    candidates.push(`${resolvedSpecifier}.d.ts`);
    candidates.push(`${resolvedSpecifier}.d.mts`);
    candidates.push(`${resolvedSpecifier}.d.cts`);
    candidates.push(join(resolvedSpecifier, 'index.d.ts'));
    candidates.push(join(resolvedSpecifier, 'index.d.mts'));
    candidates.push(join(resolvedSpecifier, 'index.d.cts'));
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Run-scoped caches shared by every `replaceTypes` call of one `generateTypes` run.
 *
 * Each top-level declaration file re-walks the whole bundled declaration graph it references, with its own
 * `visited` set, and the order of those walks decides which copy wins when two sources map to the same
 * `_types` path. The caches below keep that exact sequence of writes; they only skip re-parsing files,
 * re-resolving packages, and rewriting files with the content they already hold.
 */
export function createReplaceTypesState() {
  return {
    /** @type {Map<string, Promise<any>>} copy plan per source file + destination root */
    plans: new Map(),
    /** @type {Map<string, Promise<any>>} bundled specifier resolution per specifier + resolver directory */
    resolutions: new Map(),
    /** @type {Map<string, string>} last content this run wrote to each path */
    written: new Map(),
    /** @type {Set<string>} directories this run already created */
    dirs: new Set(),
  };
}

async function ensureDir(dir, state) {
  if (state.dirs.has(dir)) {
    return;
  }
  await mkdir(dir, { recursive: true });
  state.dirs.add(dir);
}

async function writeIfChanged(file, content, state) {
  if (state.written.get(file) === content) {
    return;
  }
  await writeFile(file, content);
  state.written.set(file, content);
}

// Same escaping as ts-morph's StringLiteral#setLiteralValue (StringUtils.escapeForWithinString).
function escapeForWithinString(value, quote) {
  return value.replaceAll(quote, `\\${quote}`).replace(/(\r?\n)/g, '\\$1');
}

function parseDeclaration(file, code) {
  return new Project().createSourceFile(file, code, { overwrite: true });
}

function getBundledSpecifiers(sourceFile, bundledPackages) {
  return getModuleSpecifiers(sourceFile).filter(moduleSpecifier =>
    Array.from(bundledPackages).some(pkg => matchesBundledPackage(moduleSpecifier.getLiteralValue(), pkg)),
  );
}

async function resolveBundledSpecifier(specifier, resolverParentFile, rootDir, state) {
  const parentDir = extname(resolverParentFile) ? dirname(resolverParentFile) : resolverParentFile;
  const key = `${specifier}\0${parentDir}`;
  let resolution = state.resolutions.get(key);
  if (!resolution) {
    resolution = resolveBundledSpecifierUncached(specifier, resolverParentFile, rootDir);
    state.resolutions.set(key, resolution);
  }
  return resolution;
}

async function resolveBundledSpecifierUncached(specifier, resolverParentFile, rootDir) {
  const pkgName = getPackageName(specifier);
  if (!pkgName) {
    return null;
  }

  let sourcePkgName = pkgName;
  let sourcePkgRootPath = await getPackageRootPath(pkgName, resolverParentFile);
  let typesFiles;

  if (sourcePkgRootPath) {
    const pkgJson = JSON.parse(await readFile(join(sourcePkgRootPath, 'package.json'), 'utf8'));
    const exportSpecifier =
      pkgJson.name && pkgJson.name !== pkgName ? specifier.replace(pkgName, pkgJson.name) : specifier;
    typesFiles = resolveExports(pkgJson, exportSpecifier, {
      conditions: ['types'],
    });
    if (!pkgJson.exports) {
      const subpath = specifier.slice(pkgName.length + 1);
      const typesEntry = subpath || pkgJson.types || pkgJson.typings;
      if (typesEntry) {
        typesFiles = [typesEntry];
      }
    }
  }

  if (!typesFiles || typesFiles.length === 0) {
    const typesPkgName = getTypesPackageName(pkgName);
    const typesPkgRootPath = await getPackageRootPath(typesPkgName, resolverParentFile);
    if (!typesPkgRootPath) {
      return null;
    }

    sourcePkgName = typesPkgName;
    sourcePkgRootPath = typesPkgRootPath;
    const pkgJson = JSON.parse(await readFile(join(sourcePkgRootPath, 'package.json'), 'utf8'));
    typesFiles = pkgJson.types ? [pkgJson.types] : resolveExports(pkgJson, typesPkgName, { conditions: ['types'] });
  }

  if (!typesFiles || typesFiles.length === 0) {
    return null;
  }

  const sourceTypesPath =
    (await resolveRelativeDeclaration(`./${typesFiles[0]}`, join(sourcePkgRootPath, 'package.json'))) ??
    join(sourcePkgRootPath, typesFiles[0]);
  const destTypesRoot = join(rootDir, 'dist', '_types', sourcePkgName.replace('/', '_'));

  // Legacy CommonJS declarations must not inherit the consuming package's ESM mode.
  const sourcePackage = JSON.parse(await readFile(join(sourcePkgRootPath, 'package.json'), 'utf8'));

  return {
    sourcePkgRootPath,
    sourceTypesPath,
    destTypesRoot,
    destTypesPath: join(destTypesRoot, relative(sourcePkgRootPath, sourceTypesPath)),
    packageJson: JSON.stringify({ type: sourcePackage.type ?? 'commonjs' }),
  };
}

/**
 * Resolves every bundled import of `sourceFile` and returns the rewritten text plus the bundled declaration
 * graphs that have to be copied, in import order.
 */
async function planBundledReferences(sourceFile, fileDir, resolverParentFile, rootDir, bundledPackages, state) {
  const specifiers = getBundledSpecifiers(sourceFile, bundledPackages);
  if (specifiers.length === 0) {
    return null;
  }

  const steps = [];
  const edits = [];
  for (const moduleSpecifier of specifiers) {
    const resolution = await resolveBundledSpecifier(
      moduleSpecifier.getLiteralValue(),
      resolverParentFile,
      rootDir,
      state,
    );
    if (!resolution) {
      continue;
    }
    steps.push(resolution);

    // Module specifiers must always use POSIX separators ('/'), but path.relative()
    // returns OS-native separators (backslashes on Windows). Without this normalization,
    // generated .d.ts files contain unresolvable specifiers like '..\_types\...' that
    // break `moduleResolution: "bundler"` on Windows. On POSIX, sep === '/' so this is a no-op.
    let relativeImport = relative(fileDir, resolution.destTypesPath)
      .split(sep)
      .join('/')
      .replace(/\.d\.([cm]?)ts$/, '.$1js');
    if (!relativeImport.startsWith('.')) {
      relativeImport = './' + relativeImport;
    }

    const quote = moduleSpecifier.getText()[0] === "'" ? "'" : '"';
    edits.push({
      start: moduleSpecifier.getStart() + 1,
      end: moduleSpecifier.getEnd() - 1,
      text: escapeForWithinString(relativeImport, quote),
    });
  }

  let text = sourceFile.getFullText();
  // Apply from the end of the file so earlier offsets stay valid. `edits` is in collection order, not source order.
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }

  return { text, steps };
}

async function getCopyPlan(sourceFilePath, sourceRootDir, destRootDir, rootDir, bundledPackages, state) {
  const key = `${sourceFilePath}\0${sourceRootDir}\0${destRootDir}`;
  let plan = state.plans.get(key);
  if (!plan) {
    plan = buildCopyPlan(sourceFilePath, sourceRootDir, destRootDir, rootDir, bundledPackages, state);
    state.plans.set(key, plan);
  }
  return plan;
}

async function buildCopyPlan(sourceFilePath, sourceRootDir, destRootDir, rootDir, bundledPackages, state) {
  const destFilePath = join(destRootDir, relative(sourceRootDir, sourceFilePath));
  const code = await readFile(sourceFilePath, 'utf8');
  const sourceFile = parseDeclaration(sourceFilePath, code);

  const bundled = await planBundledReferences(
    sourceFile,
    dirname(destFilePath),
    sourceFilePath,
    rootDir,
    bundledPackages,
    state,
  );

  const relativeChildren = [];
  for (const moduleSpecifier of getModuleSpecifiers(sourceFile)) {
    const referencedFile = await resolveRelativeDeclaration(moduleSpecifier.getLiteralValue(), sourceFilePath);
    if (referencedFile && resolve(referencedFile).startsWith(resolve(sourceRootDir))) {
      relativeChildren.push(referencedFile);
    }
  }

  return {
    destFilePath,
    text: bundled?.text ?? code,
    steps: bundled?.steps ?? null,
    relativeChildren,
  };
}

async function copyBundledDependencies(steps, rootDir, bundledPackages, visited, state) {
  for (const step of steps) {
    await ensureDir(step.destTypesRoot, state);
    await writeIfChanged(join(step.destTypesRoot, 'package.json'), step.packageJson, state);
    await copyDeclarationGraph(
      step.sourceTypesPath,
      step.sourcePkgRootPath,
      step.destTypesRoot,
      rootDir,
      bundledPackages,
      visited,
      state,
    );
  }
}

async function copyDeclarationGraph(
  sourceFilePath,
  sourceRootDir,
  destRootDir,
  rootDir,
  bundledPackages,
  visited,
  state,
) {
  const normalizedSourceFilePath = resolve(sourceFilePath);
  if (visited.has(normalizedSourceFilePath)) {
    return;
  }

  visited.add(normalizedSourceFilePath);

  const plan = await getCopyPlan(sourceFilePath, sourceRootDir, destRootDir, rootDir, bundledPackages, state);
  await ensureDir(dirname(plan.destFilePath), state);

  if (plan.steps) {
    await copyBundledDependencies(plan.steps, rootDir, bundledPackages, visited, state);
  }
  // A file with bundled imports is written after its dependencies, so it wins if one of them maps to the same path.
  await writeIfChanged(plan.destFilePath, plan.text, state);

  for (const referencedFile of plan.relativeChildren) {
    await copyDeclarationGraph(referencedFile, sourceRootDir, destRootDir, rootDir, bundledPackages, visited, state);
  }
}

export async function replaceTypes(file, rootDir, bundledPackages, state = createReplaceTypesState()) {
  const code = await readFile(file, 'utf8');
  const sourceFile = parseDeclaration(file, code);
  const bundled = await planBundledReferences(sourceFile, dirname(file), file, rootDir, bundledPackages, state);

  if (!bundled) {
    return;
  }

  await copyBundledDependencies(bundled.steps, rootDir, bundledPackages, new Set(), state);
  await writeIfChanged(file, bundled.text, state);
}
