#!/usr/bin/env node
/** Generate Drizzle schema for @mastra/pg. Usage: pnpm generate:drizzle [--check] */

import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateDrizzleSchema,
  extractImports,
  generateRelationsFactory,
} from '../../../scripts/drizzle-schema-generator/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = join(__dirname, '..');

await generateDrizzleSchema({
  storeRoot: STORE_ROOT,
  dialect: 'postgresql',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5434/mastra',
  storeExport: 'PostgresStore',
  dockerComposeFile: join(STORE_ROOT, 'docker-compose.yaml'),
  dockerServiceName: 'db',
  dockerHealthCheck: 'pg_isready -U postgres',
  cleanDatabase: async (composeFile, serviceName) => {
    const exec = cmd => execSync(cmd, { stdio: 'pipe' });
    try {
      exec(`docker-compose -f "${composeFile}" exec -T ${serviceName} dropdb -U postgres --if-exists mastra`);
      exec(`docker-compose -f "${composeFile}" exec -T ${serviceName} createdb -U postgres mastra`);
    } catch {} // Database might not exist yet
  },
  postProcess: (schemaContent, relationsContent) => {
    // Fix constraint prefixes and remove .op() calls (drizzle-kit bug #5056)
    schemaContent = schemaContent.replace(/public_mastra_/g, 'mastra_').replace(/\.op\(['"][^'"]+['"]\)/g, '');

    const tableNames = [...schemaContent.matchAll(/export const (\w+) = pgTable\(/g)].map(m => m[1]);
    if (!tableNames.length) return schemaContent;

    // Add pgSchema import
    schemaContent = schemaContent.replace(/import \{([^}]*)pgTable([^}]*)\}/, (m, a, b) =>
      m.includes('pgSchema') ? m : `import {${a}pgTable, pgSchema${b}}`,
    );

    let { imports: schemaImports, body: schemaBody } = extractImports(schemaContent);
    schemaBody = schemaBody
      .replace(/export const (\w+) = pgTable\(/g, 'const $1 = pgTable(')
      .replace(/\bpgTable\(/g, 'table(');

    const { imports: relationsImports, factory: relationsFactory } = generateRelationsFactory(relationsContent);

    return `${schemaImports}
${relationsImports}
export interface MastraSchemaConfig {
  /** PostgreSQL schema name (e.g., 'mastra'). Defaults to 'public'. */
  schemaName?: string;
}

export function createMastraSchema(config?: MastraSchemaConfig) {
const schemaName = config?.schemaName;
const table = (schemaName ? pgSchema(schemaName).table : pgTable) as typeof pgTable;
${schemaBody.trim()}
return { ${tableNames.join(', ')} };
}
${relationsFactory}`;
  },
});
