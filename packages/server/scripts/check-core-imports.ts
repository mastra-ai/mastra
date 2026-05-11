import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');
const repoRoot = resolve(packageRoot, '../..');
const corePackageRoot = join(repoRoot, 'packages', 'core');
const packageJsonPath = join(packageRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
  peerDependencies?: Record<string, string>;
};

type CoreValueImport = {
  file: string;
  moduleName: string;
  names: string[];
};

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: fileName => fileName,
  getCurrentDirectory: () => repoRoot,
  getNewLine: () => ts.sys.newLine,
};

const coreRange = packageJson.peerDependencies?.['@mastra/core'];
const coreVersion = coreRange?.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1];

if (!coreRange || !coreVersion) {
  console.error('✗ Could not determine @mastra/core peer dependency floor from package.json');
  process.exit(1);
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

function collectCoreValueImports() {
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
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function extractCorePackage(version: string, tempDir: string) {
  const pack = runCommand(
    'npm',
    ['pack', `@mastra/core@${version}`, '--pack-destination', tempDir, '--silent'],
    repoRoot,
  );

  if (pack.status !== 0) {
    throw new Error(`Failed to download @mastra/core@${version}`);
  }

  const tarball = pack.stdout.trim().split('\n').at(-1);

  if (!tarball) {
    throw new Error(`npm pack did not return a tarball for @mastra/core@${version}`);
  }

  const tarballPath = join(tempDir, tarball);
  const extract = runCommand('tar', ['-xzf', tarballPath, '-C', tempDir], repoRoot);

  if (extract.status !== 0) {
    throw new Error(`Failed to extract ${tarballPath}`);
  }

  return join(tempDir, 'package');
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

function writeImportCheck(imports: CoreValueImport[], destination: string) {
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

const tempDir = mkdtempSync(join(corePackageRoot, '.core-import-check-'));
let exitCode = 1;

try {
  const imports = collectCoreValueImports();
  const moduleNames = [...new Set(imports.map(item => item.moduleName))].sort();
  const floorCoreRoot = extractCorePackage(coreVersion, tempDir);
  const { paths, availablePaths } = createCorePaths(floorCoreRoot, moduleNames);
  const checkFilePath = join(tempDir, 'core-import-check.ts');
  const tsconfigPath = join(tempDir, 'tsconfig.json');

  writeImportCheck(imports, checkFilePath);

  writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        extends: join(packageRoot, 'tsconfig.json'),
        compilerOptions: {
          moduleResolution: 'bundler',
          paths,
          typeRoots: [join(repoRoot, 'node_modules', '@types')],
        },
        include: [checkFilePath],
      },
      null,
      2,
    ),
  );

  console.info(`Checking @mastra/server value imports against @mastra/core@${coreVersion} (${coreRange})`);
  console.info(
    `Resolved ${availablePaths}/${moduleNames.length} @mastra/core import paths from the peer dependency floor`,
  );
  console.info(`Checking ${imports.reduce((count, item) => count + item.names.length, 0)} named value imports`);

  const status = runTypeCheck(tsconfigPath);

  if (status === 0) {
    console.info('✓ @mastra/core value imports are compatible with the peer dependency floor');
  } else {
    console.error('✗ @mastra/core value imports are not compatible with the peer dependency floor');
    console.error(
      `  Either avoid newer @mastra/core value imports or bump the peer dependency floor in ${relative(repoRoot, packageJsonPath)}`,
    );
  }

  exitCode = status;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

process.exit(exitCode);
