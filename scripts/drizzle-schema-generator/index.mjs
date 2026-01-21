#!/usr/bin/env node
/**
 * Shared Drizzle schema generator for Mastra storage packages.
 * Generates schemas via database introspection using drizzle-kit.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Generate Drizzle schema by introspecting a database. */
export async function generateDrizzleSchema({
  storeRoot,
  dialect,
  databaseUrl,
  storeModule = './dist/index.js',
  storeExport,
  createStoreConfig,
  dockerComposeFile,
  dockerServiceName,
  dockerHealthCheck,
  cleanDatabase,
  postProcess,
  check = process.argv.includes('--check'),
  skipDocker = process.env.SKIP_DOCKER === 'true',
  skipTableInit = false, // Skip table initialization (if done externally)
}) {
  // Use unique temp directory
  const tempDir = mkdtempSync(join(tmpdir(), 'drizzle-gen-'));
  const drizzleOutputDir = join(tempDir, 'output');
  const drizzleConfigPath = join(tempDir, 'drizzle.config.ts');

  const TARGET_DIR = join(storeRoot, 'src', 'drizzle');
  const TARGET_FILE = join(TARGET_DIR, 'schema.ts');

  console.log(`=== Drizzle Schema Generator ${check ? '(Check Mode)' : ''} ===\n`);

  // Check prerequisites
  const distPath = join(storeRoot, 'dist', 'index.js');
  if (!existsSync(distPath)) {
    console.error(`Error: ${distPath} not found. Run \`pnpm build\` first.`);
    process.exit(1);
  }

  let generatedOutput;

  try {
    // Start database if using Docker
    if (!skipDocker && dockerComposeFile && dockerServiceName) {
      console.log('Starting database...');
      execSync(`docker-compose -f "${dockerComposeFile}" up -d`, { stdio: 'inherit' });
      await waitForDatabase(dockerComposeFile, dockerServiceName, dockerHealthCheck);

      if (cleanDatabase) {
        console.log('Cleaning database...');
        await cleanDatabase(dockerComposeFile, dockerServiceName);
      }
    }

    // Initialize tables via dynamic import (unless already done externally)
    if (!skipTableInit) {
      console.log('Initializing Mastra tables...');
      const modulePath = join(storeRoot, storeModule);
      const storeModuleExports = await import(modulePath);
      const StoreClass = storeModuleExports[storeExport];

      if (!StoreClass) {
        throw new Error(`Export "${storeExport}" not found in ${storeModule}`);
      }

      const storeConfig = createStoreConfig
        ? createStoreConfig(databaseUrl)
        : { id: 'drizzle-gen', connectionString: databaseUrl };

      const store = new StoreClass(storeConfig);

      // Init domains sequentially (sorted) for deterministic table order
      const stores = store.stores;
      if (stores && typeof stores === 'object' && !Array.isArray(stores)) {
        for (const domain of Object.keys(stores).sort()) {
          await stores[domain].init();
        }
      }
      console.log('Tables created successfully');
    }

    // Create temporary drizzle config
    mkdirSync(drizzleOutputDir, { recursive: true });
    writeFileSync(
      drizzleConfigPath,
      `import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: ${JSON.stringify(dialect)},
  out: ${JSON.stringify(drizzleOutputDir)},
  dbCredentials: { url: ${JSON.stringify(databaseUrl)} },
});
`,
    );

    // Run drizzle-kit introspect
    console.log('\nRunning drizzle-kit introspect...');
    execSync(`pnpm drizzle-kit introspect --config "${drizzleConfigPath}"`, {
      stdio: 'inherit',
      cwd: storeRoot,
    });

    // Read raw schema
    const rawSchemaPath = join(drizzleOutputDir, 'schema.ts');
    if (!existsSync(rawSchemaPath)) {
      throw new Error('drizzle-kit did not generate schema.ts');
    }
    const relationsPath = join(drizzleOutputDir, 'relations.ts');
    if (!existsSync(relationsPath)) {
      throw new Error('drizzle-kit did not generate relations.ts');
    }

    const rawSchemaContent = readFileSync(rawSchemaPath, 'utf-8');
    const rawRelationsContent = readFileSync(relationsPath, 'utf-8');

    // Fail if test tables are present (indicates dirty database)
    if (rawSchemaContent.includes("Table('test_") || rawSchemaContent.includes('Table("test_')) {
      throw new Error(
        'Generated schema contains test tables. This indicates the database was not clean. ' +
          'Ensure schema generation uses a fresh database instance.',
      );
    }

    // Apply store-specific post-processing
    const unformattedOutput = postProcess(rawSchemaContent, rawRelationsContent);

    // Add header and format
    generatedOutput = formatOutput(unformattedOutput);
  } finally {
    cleanup(tempDir);
  }

  // Check mode or generate mode
  if (check) {
    return validateOutput(generatedOutput, TARGET_FILE);
  } else {
    mkdirSync(TARGET_DIR, { recursive: true });
    writeFileSync(TARGET_FILE, generatedOutput);
    console.log(`\n✅ Schema written to: ${TARGET_FILE}`);
  }
}

async function waitForDatabase(dockerComposeFile, serviceName, healthCheck, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`docker-compose -f "${dockerComposeFile}" exec -T ${serviceName} ${healthCheck}`, { stdio: 'pipe' });
      console.log('Database is ready');
      return;
    } catch {
      if (i % 5 === 0) console.log(`Waiting for database... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Database did not become ready in time');
}

function formatOutput(content) {
  const header = `/**
 * Auto-generated Drizzle schema for Mastra tables.
 *
 * DO NOT EDIT THIS FILE DIRECTLY.
 * Regenerate with: pnpm generate:drizzle
 *
 * @generated
 */
`;

  return execSync('pnpm prettier --stdin-filepath schema.ts', {
    input: header + content,
    encoding: 'utf-8',
  });
}

function validateOutput(generatedOutput, targetPath) {
  if (!existsSync(targetPath)) {
    console.error(`\n❌ Schema file missing: ${targetPath}`);
    console.error('Run `pnpm generate:drizzle` to generate it.\n');
    process.exit(1);
  }

  const normalize = s =>
    s
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  if (normalize(generatedOutput) === normalize(readFileSync(targetPath, 'utf-8'))) {
    console.log('\n✅ Drizzle schema is up-to-date');
    return true;
  }

  console.error('\n❌ Drizzle schema is out of date!');
  console.error('Run `pnpm generate:drizzle` and commit the changes.\n');

  const diffDir = mkdtempSync(join(tmpdir(), 'drizzle-diff-'));
  const tempPath = join(diffDir, 'schema.ts');
  writeFileSync(tempPath, generatedOutput);
  try {
    execSync(`diff -u "${targetPath}" "${tempPath}"`, { stdio: 'inherit' });
  } catch {
    /* diff exits 1 on difference */
  }
  cleanup(diffDir);
  process.exit(1);
}

function cleanup(...paths) {
  for (const p of paths) {
    if (p) rmSync(p, { recursive: true, force: true });
  }
}

// ============ Shared Post-Processing Helpers ============

/**
 * Extract import statements and body from generated schema content.
 * Handles imports that may have leading whitespace (drizzle-kit quirk).
 */
export function extractImports(content) {
  const imports =
    content
      .match(/^\s*import .+$/gm)
      ?.map(s => s.trim())
      .join('\n') || '';
  const body = content.replace(/^\s*import .+\n?/gm, '');
  return { imports, body };
}

/**
 * Generate a createMastraRelations factory from drizzle-kit's relations.ts output.
 * Transforms the static imports/exports into a factory function that takes the schema.
 *
 * @param {string} relationsContent - Raw content from relations.ts
 * @returns {{ imports: string, factory: string }} - Import statement and factory function code
 */
export function generateRelationsFactory(relationsContent) {
  // Extract table names from schema import (e.g., `import { threads, messages } from './schema'` -> ['threads', 'messages'])
  const tableImportMatch = relationsContent.match(/import \{([^}]+)\} from ['"]\.\/schema['"]/);
  const tables = tableImportMatch
    ? tableImportMatch[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : [];

  // Extract relation export names and body
  const relationNames = [...relationsContent.matchAll(/export const (\w+) =/g)].map(m => m[1]);
  const { body: rawRelationsBody } = extractImports(relationsContent);
  const relationsBody = rawRelationsBody.replace(/export const /g, 'const ').trim();

  return {
    imports: `import { relations } from 'drizzle-orm/relations';\n`,
    factory: `
/** Type representing all Mastra tables. Use for compile-time safety. */
export type MastraSchema = ReturnType<typeof createMastraSchema>;

/**
 * Create Drizzle relations for the Mastra schema.
 * Pass the schema from createMastraSchema() to get typed relations.
 */
export function createMastraRelations(schema: MastraSchema) {
  const { ${tables.join(', ')} } = schema;
  ${relationsBody}
  return { ${relationNames.join(', ')} };
}

/** Type representing Mastra relations. */
export type MastraRelations = ReturnType<typeof createMastraRelations>;
`,
  };
}
