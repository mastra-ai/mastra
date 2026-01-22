/**
 * SQLite-specific helpers for Drizzle schema generation.
 * Used by libsql and cloudflare-d1 stores.
 */

import { extractImports, generateRelationsFactory } from './index.mjs';

/**
 * Create a SQLite factory-wrapped schema from raw drizzle-kit output.
 * @param {Object} opts
 * @param {string} opts.schemaContent - Raw schema.ts content from drizzle-kit
 * @param {string} [opts.relationsContent=''] - Raw relations.ts content from drizzle-kit
 * @param {boolean} [opts.supportsTablePrefix=true] - Whether to include tablePrefix support
 */
export function createSqliteFactorySchema({ schemaContent, relationsContent, supportsTablePrefix = true }) {
  // Fix AnySQLiteColumn import to include 'type' keyword
  const fixedSchemaContent = schemaContent.replace(/import \{ ([^}]*)\bAnySQLiteColumn\b([^}]*) \}/g, (m, a, b) =>
    m.includes('type AnySQLiteColumn') ? m : `import { ${a}type AnySQLiteColumn${b} }`,
  );

  // Extract table names
  const tableNames = [...fixedSchemaContent.matchAll(/export const (\w+) = sqliteTable\(/g)].map(m => m[1]);
  if (!tableNames.length) return fixedSchemaContent;

  // Split imports from body
  const { imports: schemaImports, body: schemaBody } = extractImports(fixedSchemaContent);

  // Generate relations factory
  const { imports: relationsImports, factory: relationsFactory } = generateRelationsFactory(relationsContent);

  if (supportsTablePrefix) {
    // Transform: export const X = sqliteTable("name" -> const X = sqliteTable(tableName("name")
    const transformedBody = schemaBody.replace(
      /export const (\w+) = sqliteTable\(["']([^"']+)["']/g,
      'const $1 = sqliteTable(tableName("$2")',
    );

    return `${schemaImports}
${relationsImports}
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
${relationsFactory}`;
  }

  // No tablePrefix: simpler factory
  const simpleBody = schemaBody.replace(/export const (\w+) = sqliteTable\(/g, 'const $1 = sqliteTable(');

  return `${schemaImports}
${relationsImports}
export function createMastraSchema() {
${simpleBody.trim()}
return { ${tableNames.join(', ')} };
}
${relationsFactory}`;
}
