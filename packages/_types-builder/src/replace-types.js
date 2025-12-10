// Typescript tooling really sucks so we are going to do some transfomrations ourselves
import { createReadStream } from 'fs';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { join, dirname, relative } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { getPackageInfo } from 'local-pkg';
import { pathToFileURL } from 'node:url';
import { exports as resolveExports } from 'resolve.exports';

async function getPackageName(moduleSpecifier) {
  if (moduleSpecifier.startsWith('@')) {
    return moduleSpecifier.split('/').slice(0, 2).join('/');
  }

  return moduleSpecifier.split('/')[0];
}

async function getPackageRootPath(packageName, parentPath) {
  let rootPath;

  try {
    let options;
    if (parentPath) {
      if (!parentPath.startsWith('file://')) {
        parentPath = pathToFileURL(parentPath).href;
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

export async function replaceTypes(file, rootDir, bundledPackages) {
  const normalizedBundledPackages = Array.from(bundledPackages).map(pkg => pkg.replace('*', ''));
  const shouldRunEmbed = await new Promise((resolve, reject) => {
    let found = false;

    createReadStream(file).pipe(
      new Writable({
        write(chunk, encoding, callback) {
          const hasExternal = normalizedBundledPackages.some(pkg => chunk.includes(pkg));
          if (hasExternal) {
            found = true;
            resolve(found);
          }
          callback();
        },
        final(callback) {
          if (!found) {
            resolve(false);
          }
          callback();
        },
      }),
    );
  });

  if (!shouldRunEmbed) {
    return;
  }

  const importsToReplace = new Set();

  const Program = new Project();
  const sourceFile = Program.addSourceFileAtPath(file);
  sourceFile.getStatements().forEach(statement => {
    if (statement.getKind() === SyntaxKind.ImportDeclaration) {
      const importDeclaration = /** @type {import('ts-morph').ImportDeclaration} */ (statement);
      const moduleSpecifier = importDeclaration.getModuleSpecifier();

      const hasExternal = normalizedBundledPackages.some(pkg => moduleSpecifier.getLiteralValue().includes(pkg));

      if (hasExternal) {
        importsToReplace.add(moduleSpecifier);
      }
    }
  });

  if (importsToReplace.size > 0) {
    const fileDirname = dirname(file);
    const typesDestDir = join(rootDir, 'dist', '_types');

    for (const moduleSpecifier of importsToReplace) {
      const pkgName = await getPackageName(moduleSpecifier.getLiteralValue());
      const pkgRootPath = await getPackageRootPath(pkgName, file);
      if (pkgRootPath) {
        const pkgJson = JSON.parse(await readFile(join(pkgRootPath, 'package.json'), 'utf8'));
        const typesFiles = resolveExports(pkgJson, moduleSpecifier.getLiteralValue(), {
          conditions: ['types'],
        });
        if (typesFiles.length > 0) {
          const typesFile = typesFiles[0];
          const sourceTypesPath = join(pkgRootPath, typesFile);
          const destTypesPath = join(typesDestDir, pkgName.replace('/', '_'), typesFile);

          // Create the destination directory and copy the types file
          await mkdir(dirname(destTypesPath), { recursive: true });
          await copyFile(sourceTypesPath, destTypesPath);

          // Calculate relative import path from the current file to the copied types file
          let relativeImport = relative(fileDirname, destTypesPath);
          if (!relativeImport.startsWith('.')) {
            relativeImport = './' + relativeImport;
          }

          // Replace the module specifier with the new relative import
          moduleSpecifier.setLiteralValue(relativeImport.replace('.d.ts', '.js'));
        }
      }
    }

    await sourceFile.save();
  }
}
