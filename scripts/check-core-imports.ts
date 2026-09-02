import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import ts from 'typescript-classic';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const corePackageRoot = join(repoRoot, 'packages', 'core');
const corePackageJsonPath = join(corePackageRoot, 'package.json');
const corePackageJson = JSON.parse(readFileSync(corePackageJsonPath, 'utf-8')) as {
  version: string;
};
const skippedDirectories = new Set([
  '.git',
  '.pnpm',
  'build',
  'dist',
  'docs',
  'e2e-tests',
  'examples',
  'explorations',
  'node_modules',
]);
type CoreValueImport = {
  file: string;
  moduleName: string;
  names: string[];
};

type PackageInfo = {
  coreRange: string;
  coreFloorVersion?: string;
  corePackVersion?: string;
  coreRangeError?: string;
  name: string;
  packageJsonPath: string;
  root: string;
};

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: fileName => fileName,
  getCurrentDirectory: () => repoRoot,
  getNewLine: () => ts.sys.newLine,
};

function findPackageRoots(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const roots = existsSync(join(dir, 'package.json')) ? [dir] : [];

  for (const entry of entries) {
    if (!entry.isDirectory() || skippedDirectories.has(entry.name)) continue;
    roots.push(...findPackageRoots(join(dir, entry.name)));
  }

  return roots;
}

function resolveCoreSemverRange(coreRange: string) {
  if (!coreRange.startsWith('workspace:')) {
    return coreRange;
  }

  const workspaceRange = coreRange.slice('workspace:'.length);

  if (workspaceRange === '*' || workspaceRange === '^' || workspaceRange === '~') {
    return workspaceRange === '*' ? corePackageJson.version : `${workspaceRange}${corePackageJson.version}`;
  }

  return workspaceRange;
}

function getPackageInfo(packageRoot: string): PackageInfo | undefined {
  const packageJsonPath = join(packageRoot, 'package.json');

  if (
    !existsSync(packageJsonPath) ||
    !existsSync(join(packageRoot, 'src')) ||
    !existsSync(join(packageRoot, 'tsconfig.json'))
  ) {
    return undefined;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    name?: string;
    peerDependencies?: Record<string, string>;
    private?: boolean;
  };
  const coreRange = packageJson.peerDependencies?.['@mastra/core'];

  if (packageJson.private || !coreRange) {
    return undefined;
  }

  const packageInfo = {
    coreRange,
    name: packageJson.name ?? relative(repoRoot, packageRoot),
    packageJsonPath,
    root: packageRoot,
  };

  try {
    const coreFloorVersion = semver.minVersion(resolveCoreSemverRange(coreRange), { includePrerelease: true })?.version;
    const corePackVersion = coreFloorVersion?.endsWith('-0') ? coreFloorVersion.slice(0, -2) : coreFloorVersion;

    if (!coreFloorVersion || !corePackVersion) {
      return {
        ...packageInfo,
        coreRangeError: `Could not determine @mastra/core peer dependency floor from range "${coreRange}"`,
      };
    }

    return {
      ...packageInfo,
      coreFloorVersion,
      corePackVersion,
    };
  } catch {
    return {
      ...packageInfo,
      coreRangeError: `Could not determine @mastra/core peer dependency floor from range "${coreRange}"`,
    };
  }
}

function getPackagesToCheck() {
  if (process.argv.length > 2) {
    const packages = process.argv.slice(2).map(packagePath => {
      const packageRoot = resolve(repoRoot, packagePath);
      const packageInfo = getPackageInfo(packageRoot);

      if (!packageInfo) {
        throw new Error(
          `${packagePath} must contain package.json, src/, tsconfig.json, and an @mastra/core peer dependency`,
        );
      }

      return packageInfo;
    });

    return packages;
  }

  const packages: PackageInfo[] = [];
  const defaultPackageRoots = [join(repoRoot, 'packages', 'server'), ...findPackageRoots(join(repoRoot, 'stores'))];

  for (const packageRoot of defaultPackageRoots) {
    const packageInfo = getPackageInfo(packageRoot);
    if (packageInfo) packages.push(packageInfo);
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

function findTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__fixtures__') return [];
      return findTypeScriptFiles(path);
    }

    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return [];
    return [path];
  });
}

function getModuleName(moduleSpecifier: ts.Expression) {
  if (!ts.isStringLiteral(moduleSpecifier) || !moduleSpecifier.text.startsWith('@mastra/core')) return null;
  return moduleSpecifier.text;
}

function collectCoreValueImports(packageRoot: string) {
  const imports: CoreValueImport[] = [];

  for (const file of findTypeScriptFiles(join(packageRoot, 'src'))) {
    const sourceText = readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;

      const moduleName = getModuleName(statement.moduleSpecifier);
      if (!moduleName) continue;

      const namedBindings = statement.importClause?.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;

      const names = namedBindings.elements
        .filter(element => !element.isTypeOnly)
        .map(element => element.propertyName?.text ?? element.name.text);

      if (names.length > 0) {
        imports.push({ file, moduleName, names });
      }
    }
  }

  return imports;
}

function runCommand(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function formatCommandFailure(result: ReturnType<typeof runCommand>) {
  const stderr = result.stderr.trim();
  return stderr ? `\n${stderr}` : '';
}

function extractTarball(tarball: string, tempDir: string) {
  const tarballPath = join(tempDir, tarball);
  const extract = runCommand('tar', ['-xzf', tarballPath, '-C', tempDir], repoRoot);

  if (extract.status !== 0) {
    throw new Error(`Failed to extract ${tarballPath}${formatCommandFailure(extract)}`);
  }

  return join(tempDir, 'package');
}

function packLocalCore(version: string, tempDir: string) {
  if (corePackageJson.version !== version) {
    return undefined;
  }

  console.info(
    `@mastra/core@${version} is not available from npm; packing local ${relative(repoRoot, corePackageRoot)} because its version matches`,
  );

  const pack = runCommand('npm', ['pack', corePackageRoot, '--pack-destination', tempDir, '--silent'], repoRoot);

  if (pack.status !== 0) {
    throw new Error(`Failed to pack local @mastra/core@${version}${formatCommandFailure(pack)}`);
  }

  const tarball = pack.stdout.trim().split('\n').at(-1);

  if (!tarball) {
    throw new Error(`npm pack did not return a tarball for local @mastra/core@${version}`);
  }

  return extractTarball(tarball, tempDir);
}

function extractCorePackage(packVersion: string, tempDir: string) {
  const pack = runCommand(
    'npm',
    ['pack', `@mastra/core@${packVersion}`, '--pack-destination', tempDir, '--silent'],
    repoRoot,
  );

  if (pack.status === 0) {
    const tarball = pack.stdout.trim().split('\n').at(-1);

    if (!tarball) {
      throw new Error(`npm pack did not return a tarball for @mastra/core@${packVersion}`);
    }

    return extractTarball(tarball, tempDir);
  }

  const localCoreRoot = packLocalCore(packVersion, tempDir);

  if (localCoreRoot) {
    return localCoreRoot;
  }

  throw new Error(`Failed to download @mastra/core@${packVersion}${formatCommandFailure(pack)}`);
}

function getExportTypesTarget(exportValue: unknown): string | undefined {
  if (typeof exportValue === 'string') {
    return exportValue.endsWith('.d.ts') ? exportValue : undefined;
  }

  if (!exportValue || typeof exportValue !== 'object') {
    return undefined;
  }

  const exportRecord = exportValue as Record<string, unknown>;

  if (typeof exportRecord.types === 'string') {
    return exportRecord.types;
  }

  return getExportTypesTarget(exportRecord.import) ?? getExportTypesTarget(exportRecord.require);
}

function getCoreExportSubpath(moduleName: string) {
  if (moduleName === '@mastra/core') {
    return '.';
  }

  return `.${moduleName.slice('@mastra/core'.length)}`;
}

function resolveExportTypesPath(coreRoot: string, moduleName: string) {
  const corePackageJson = JSON.parse(readFileSync(join(coreRoot, 'package.json'), 'utf-8')) as {
    exports?: Record<string, unknown>;
  };
  const exportsMap = corePackageJson.exports ?? {};
  const exportSubpath = getCoreExportSubpath(moduleName);
  const exactTarget = getExportTypesTarget(exportsMap[exportSubpath]);

  if (exactTarget) {
    return join(coreRoot, exactTarget.replace(/^\.\//, ''));
  }

  for (const [exportKey, exportValue] of Object.entries(exportsMap)) {
    if (!exportKey.includes('*')) continue;

    const [prefix, suffix] = exportKey.split('*') as [string, string];

    if (!exportSubpath.startsWith(prefix) || !exportSubpath.endsWith(suffix)) continue;

    const matchedSubpath = exportSubpath.slice(prefix.length, exportSubpath.length - suffix.length);
    const wildcardTarget = getExportTypesTarget(exportValue)?.replace('*', matchedSubpath);

    if (wildcardTarget) {
      return join(coreRoot, wildcardTarget.replace(/^\.\//, ''));
    }
  }
}

function createCorePaths(coreRoot: string, moduleNames: string[]) {
  const paths: Record<string, string[]> = {};
  let availablePaths = 0;

  for (const moduleName of moduleNames) {
    const typePath = resolveExportTypesPath(coreRoot, moduleName);

    if (typePath && existsSync(typePath)) {
      paths[moduleName] = [typePath];
      availablePaths++;
      continue;
    }

    const subpath = moduleName.replace('@mastra/core', '').replace(/^\//, '');
    // Point exact imports at a missing file so TypeScript reports the subpath as unavailable
    // instead of falling back to the workspace version of @mastra/core.
    paths[moduleName] = [join(coreRoot, '__missing__', `${subpath || 'index'}.d.ts`)];
  }

  return { paths, availablePaths };
}

function writeImportCheck(imports: CoreValueImport[], destination: string, packageRoot: string) {
  const lines = imports.flatMap(({ file, moduleName, names }, index) => {
    const uniqueNames = [...new Set(names)].sort();
    const importNames = uniqueNames.map(name => `${name} as import_${index}_${name}`).join(', ');
    return [`// ${relative(packageRoot, file)}`, `import { ${importNames} } from '${moduleName}';`];
  });

  writeFileSync(destination, `${lines.join('\n')}\n`);
}

function runTypeCheck(tsconfigPath: string) {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (configFile.error) {
    console.error(ts.formatDiagnosticsWithColorAndContext([configFile.error], formatHost));
    return 1;
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(tsconfigPath),
    undefined,
    tsconfigPath,
  );
  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
    projectReferences: parsedConfig.projectReferences,
  });

  const diagnostics = [...parsedConfig.errors, ...ts.getPreEmitDiagnostics(program)];

  if (diagnostics.length > 0) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
    return 1;
  }

  return 0;
}

function checkPackage(packageInfo: PackageInfo, floorCoreRoot: string, tempRoot: string) {
  const imports = collectCoreValueImports(packageInfo.root);
  const moduleNames = [...new Set(imports.map(item => item.moduleName))].sort();
  const { paths, availablePaths } = createCorePaths(floorCoreRoot, moduleNames);
  const packageTempDir = mkdtempSync(join(tempRoot, 'check-'));
  const checkFilePath = join(packageTempDir, 'core-import-check.ts');
  const tsconfigPath = join(packageTempDir, 'tsconfig.json');

  writeImportCheck(imports, checkFilePath, packageInfo.root);

  writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        extends: join(packageInfo.root, 'tsconfig.json'),
        compilerOptions: {
          moduleResolution: 'bundler',
          paths,
          rootDir: packageTempDir,
          typeRoots: [join(repoRoot, 'node_modules', '@types')],
        },
        include: [checkFilePath],
      },
      null,
      2,
    ),
  );

  console.info(
    `\nChecking ${packageInfo.name} value imports against @mastra/core@${packageInfo.corePackVersion} (${packageInfo.coreRange})`,
  );
  console.info(
    `Resolved ${availablePaths}/${moduleNames.length} @mastra/core import paths from the peer dependency floor`,
  );
  console.info(`Checking ${imports.reduce((count, item) => count + item.names.length, 0)} named value imports`);

  const status = runTypeCheck(tsconfigPath);

  if (status === 0) {
    console.info(`✓ ${packageInfo.name} @mastra/core value imports are compatible with the peer dependency floor`);
  } else {
    console.error(`✗ ${packageInfo.name} @mastra/core value imports are not compatible with the peer dependency floor`);
    console.error(
      `  Either avoid newer @mastra/core value imports or bump the peer dependency floor in ${relative(repoRoot, packageInfo.packageJsonPath)}`,
    );
  }

  return status;
}

const tempRoot = mkdtempSync(join(corePackageRoot, '.core-import-check-'));
let exitCode = 0;

try {
  const packages = getPackagesToCheck();
  const floorCoreRoots = new Map<string, string>();

  console.info(
    `Found ${packages.length} package${packages.length === 1 ? '' : 's'} with an @mastra/core peer dependency`,
  );

  for (const packageInfo of packages) {
    const corePackVersion = packageInfo.corePackVersion;

    if (packageInfo.coreRangeError || !corePackVersion) {
      console.error(`\n✗ Failed to check ${packageInfo.name}`);
      console.error(
        `${packageInfo.coreRangeError ?? 'Could not determine @mastra/core peer dependency floor'} in ${relative(repoRoot, packageInfo.packageJsonPath)}`,
      );
      exitCode = 1;
      continue;
    }

    try {
      let floorCoreRoot = floorCoreRoots.get(corePackVersion);

      if (!floorCoreRoot) {
        const versionTempDir = mkdtempSync(join(tempRoot, `core-${corePackVersion.replace(/[^0-9A-Za-z.-]/g, '-')}-`));
        floorCoreRoot = extractCorePackage(corePackVersion, versionTempDir);
        floorCoreRoots.set(corePackVersion, floorCoreRoot);
      }

      if (checkPackage(packageInfo, floorCoreRoot, tempRoot) !== 0) {
        exitCode = 1;
      }
    } catch (error) {
      console.error(`\n✗ Failed to check ${packageInfo.name}`);
      console.error(error instanceof Error ? error.message : error);
      exitCode = 1;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

process.exit(exitCode);
