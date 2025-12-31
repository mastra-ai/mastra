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
  const TARGET_SCHEMA = join(TARGET_DIR, 'schema.ts');

  console.log(`=== Drizzle Schema Generator ${check ? '(Check Mode)' : ''} ===\n`);

  // Check prerequisites
  const distPath = join(storeRoot, 'dist', 'index.js');
  if (!existsSync(distPath)) {
    console.error(`Error: ${distPath} not found. Run \`pnpm build\` first.`);
    process.exit(1);
  }

  let generatedSchema;

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

    let content = readFileSync(rawSchemaPath, 'utf-8');

    // Fail if test tables are present (indicates dirty database)
    if (content.includes("Table('test_") || content.includes('Table("test_')) {
      throw new Error(
        'Generated schema contains test tables. This indicates the database was not clean. ' +
          'Ensure schema generation uses a fresh database instance.',
      );
    }

    // Apply store-specific post-processing
    if (postProcess) {
      content = postProcess(content);
    }

    // Add header and format
    generatedSchema = formatSchema(content);
  } finally {
    cleanup(tempDir);
  }

  // Check mode or generate mode
  if (check) {
    return validateSchema(generatedSchema, TARGET_SCHEMA);
  } else {
    mkdirSync(TARGET_DIR, { recursive: true });
    writeFileSync(TARGET_SCHEMA, generatedSchema);
    console.log(`\n✅ Schema written to: ${TARGET_SCHEMA}`);
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

function formatSchema(content) {
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

function validateSchema(generatedSchema, targetPath) {
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
  if (normalize(generatedSchema) === normalize(readFileSync(targetPath, 'utf-8'))) {
    console.log('\n✅ Drizzle schema is up-to-date');
    return true;
  }

  console.error('\n❌ Drizzle schema is out of date!');
  console.error('Run `pnpm generate:drizzle` and commit the changes.\n');

  const diffDir = mkdtempSync(join(tmpdir(), 'drizzle-diff-'));
  const tempPath = join(diffDir, 'schema.ts');
  writeFileSync(tempPath, generatedSchema);
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
 * Fix AnySQLiteColumn import to include 'type' keyword for proper TypeScript handling.
 */
export function fixAnySQLiteColumn(content) {
  return content.replace(/import \{ ([^}]*)\bAnySQLiteColumn\b([^}]*) \}/g, (m, a, b) =>
    m.includes('type AnySQLiteColumn') ? m : `import { ${a}type AnySQLiteColumn${b} }`,
  );
}

/**
 * Create a SQLite factory-wrapped schema.
 * @param {Object} opts
 * @param {string} opts.imports - Import statements
 * @param {string} opts.body - Schema body
 * @param {string[]} opts.tableNames - Table export names
 * @param {boolean} [opts.supportsTablePrefix=true] - Whether to include tablePrefix support
 */
export function createSqliteFactorySchema({ imports, body, tableNames, supportsTablePrefix = true }) {
  if (supportsTablePrefix) {
    // Transform: export const X = sqliteTable("name" -> const X = sqliteTable(tableName("name")
    const transformedBody = body.replace(
      /export const (\w+) = sqliteTable\(["']([^"']+)["']/g,
      'const $1 = sqliteTable(tableName("$2")',
    );

    return `${imports}

export interface MastraSchemaConfig {
  /** Prefix for all table names (e.g., 'prod_' -> 'prod_mastra_threads') */
  tablePrefix?: string;
}

export function createMastraSchema(config?: MastraSchemaConfig) {
const tablePrefix = config?.tablePrefix ?? '';
const tableName = (name: string) => \`\${tablePrefix}\${name}\`;
${transformedBody.trim()}
return { ${tableNames.join(', ')} };
}

/** Type representing all Mastra tables. Use for compile-time safety. */
export type MastraSchema = ReturnType<typeof createMastraSchema>;
`;
  }

  // No tablePrefix: simpler factory
  const simpleBody = body.replace(/export const (\w+) = sqliteTable\(/g, 'const $1 = sqliteTable(');

  return `${imports}

export function createMastraSchema() {
${simpleBody.trim()}
return { ${tableNames.join(', ')} };
}

/** Type representing all Mastra tables. Use for compile-time safety. */
export type MastraSchema = ReturnType<typeof createMastraSchema>;
`;
}

/**
 * Extract table names from SQLite schema content.
 */
export function extractSqliteTableNames(content) {
  return [...content.matchAll(/export const (\w+) = sqliteTable\(/g)].map(m => m[1]);
}
