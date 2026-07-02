// Typescript tooling really sucks so we are going to do some transfomrations ourselves
import { readFile, mkdir, copyFile, stat } from 'node:fs/promises';
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
  } catch (e) {
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
 * Remove nominal brands (`#private;`, `private`/`protected` members) from all
 * class declarations in a copied `.d.ts` file.
 *
 * Bundled declaration files are *copies*: multiple packages ship their own
 * duplicate of the same class. Nominal members make those otherwise identical
 * copies mutually unassignable (e.g. `'#private' is missing in type ...`),
 * breaking users who pass instances across package boundaries (see #18682).
 * A nominal brand asserts "same declaration = same type", which is false by
 * construction in a duplicated declaration file, so we strip the brands.
 * Members are dropped entirely (not made public) so copies stay structurally
 * compatible regardless of visibility differences.
 */
export function stripNominalBrands(sourceFile) {
  const classNodes = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ClassExpression),
  ];

  for (const classNode of classNodes) {
    for (const member of [...classNode.getMembers()]) {
      // Keep constructors: visibility on a constructor affects `new` calls,
      // not instance-type assignability.
      if (member.getKind() === SyntaxKind.Constructor) {
        continue;
      }

      const name = typeof member.getName === 'function' ? member.getName() : undefined;
      if (name && name.startsWith('#')) {
        member.remove();
        continue;
      }

      if (
        typeof member.hasModifier === 'function' &&
        (member.hasModifier(SyntaxKind.PrivateKeyword) || member.hasModifier(SyntaxKind.ProtectedKeyword))
      ) {
        member.remove();
      }
    }
  }
}

async function stripNominalBrandsFromFile(file) {
  const Program = new Project();
  const sourceFile = Program.addSourceFileAtPath(file);
  stripNominalBrands(sourceFile);
  await sourceFile.save();
}

async function copyDeclarationGraph(sourceFilePath, sourceRootDir, destRootDir, rootDir, bundledPackages, visited) {
  const normalizedSourceFilePath = resolve(sourceFilePath);
  if (visited.has(normalizedSourceFilePath)) {
    return;
  }

  visited.add(normalizedSourceFilePath);

  const destFilePath = join(destRootDir, relative(sourceRootDir, sourceFilePath));
  await mkdir(dirname(destFilePath), { recursive: true });
  await copyFile(sourceFilePath, destFilePath);

  await stripNominalBrandsFromFile(destFilePath);
  await replaceBundledReferences(destFilePath, rootDir, bundledPackages, visited, sourceFilePath);

  const Program = new Project();
  const sourceFile = Program.addSourceFileAtPath(sourceFilePath);

  for (const moduleSpecifier of getModuleSpecifiers(sourceFile)) {
    const referencedFile = await resolveRelativeDeclaration(moduleSpecifier.getLiteralValue(), sourceFilePath);
    if (referencedFile && resolve(referencedFile).startsWith(resolve(sourceRootDir))) {
      await copyDeclarationGraph(referencedFile, sourceRootDir, destRootDir, rootDir, bundledPackages, visited);
    }
  }
}

async function replaceBundledReferences(file, rootDir, bundledPackages, visited, resolverParentFile = file) {
  const importsToReplace = new Set();

  const Program = new Project();
  const sourceFile = Program.addSourceFileAtPath(file);

  for (const moduleSpecifier of getModuleSpecifiers(sourceFile)) {
    const hasExternal = Array.from(bundledPackages).some(pkg =>
      matchesBundledPackage(moduleSpecifier.getLiteralValue(), pkg),
    );

    if (hasExternal) {
      importsToReplace.add(moduleSpecifier);
    }
  }

  if (importsToReplace.size === 0) {
    return;
  }

  const fileDirname = dirname(file);
  const typesDestDir = join(rootDir, 'dist', '_types');

  for (const moduleSpecifier of importsToReplace) {
    const pkgName = getPackageName(moduleSpecifier.getLiteralValue());
    if (!pkgName) {
      continue;
    }

    let sourcePkgName = pkgName;
    let sourcePkgRootPath = await getPackageRootPath(pkgName, resolverParentFile);
    let typesFiles;

    if (sourcePkgRootPath) {
      const pkgJson = JSON.parse(await readFile(join(sourcePkgRootPath, 'package.json'), 'utf8'));
      const exportSpecifier =
        pkgJson.name && pkgJson.name !== pkgName
          ? moduleSpecifier.getLiteralValue().replace(pkgName, pkgJson.name)
          : moduleSpecifier.getLiteralValue();
      typesFiles = resolveExports(pkgJson, exportSpecifier, {
        conditions: ['types'],
      });
    }

    if (!typesFiles || typesFiles.length === 0) {
      const typesPkgName = getTypesPackageName(pkgName);
      const typesPkgRootPath = await getPackageRootPath(typesPkgName, resolverParentFile);
      if (!typesPkgRootPath) {
        continue;
      }

      sourcePkgName = typesPkgName;
      sourcePkgRootPath = typesPkgRootPath;
      const pkgJson = JSON.parse(await readFile(join(sourcePkgRootPath, 'package.json'), 'utf8'));
      typesFiles = pkgJson.types ? [pkgJson.types] : resolveExports(pkgJson, typesPkgName, { conditions: ['types'] });
    }

    if (!typesFiles || typesFiles.length === 0) {
      continue;
    }

    let typesFile = typesFiles[0];
    let sourceTypesPath = join(sourcePkgRootPath, typesFile);

    if (/\.(mjs|cjs|js)$/.test(typesFile)) {
      const declarationCandidates = [
        sourceTypesPath.replace(/\.(mjs|cjs|js)$/, '.d.ts'),
        sourceTypesPath.replace(/\.(mjs|cjs|js)$/, '.d.mts'),
        sourceTypesPath.replace(/\.(mjs|cjs|js)$/, '.d.cts'),
      ];

      for (const candidate of declarationCandidates) {
        if (await pathExists(candidate)) {
          sourceTypesPath = candidate;
          typesFile = relative(sourcePkgRootPath, candidate);
          break;
        }
      }
    }

    const destTypesRoot = join(typesDestDir, sourcePkgName.replace('/', '_'));
    const destTypesPath = join(destTypesRoot, typesFile);

    await copyDeclarationGraph(sourceTypesPath, sourcePkgRootPath, destTypesRoot, rootDir, bundledPackages, visited);

    // Module specifiers must always use POSIX separators ('/'), but path.relative()
    // returns OS-native separators (backslashes on Windows). Without this normalization,
    // generated .d.ts files contain unresolvable specifiers like '..\_types\...' that
    // break `moduleResolution: "bundler"` on Windows. On POSIX, sep === '/' so this is a no-op.
    let relativeImport = relative(fileDirname, destTypesPath).split(sep).join('/');
    if (!relativeImport.startsWith('.')) {
      relativeImport = './' + relativeImport;
    }

    moduleSpecifier.setLiteralValue(relativeImport);
  }

  await sourceFile.save();
}

export async function replaceTypes(file, rootDir, bundledPackages) {
  const code = await readFile(file, 'utf8');
  const Program = new Project();
  const sourceFile = Program.createSourceFile(file, code, { overwrite: true });
  const shouldRunEmbed = getModuleSpecifiers(sourceFile).some(moduleSpecifier =>
    Array.from(bundledPackages).some(pkg => matchesBundledPackage(moduleSpecifier.getLiteralValue(), pkg)),
  );

  if (!shouldRunEmbed) {
    return;
  }

  await replaceBundledReferences(file, rootDir, bundledPackages, new Set());
}
