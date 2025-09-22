import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'drizzle-orm',
    'drizzle-orm/pg-core',
    'drizzle-orm/mysql-core',
    'drizzle-orm/sqlite-core',
    'pg',
    'mysql2',
    '@libsql/client',
    '@planetscale/database',
    '@neondatabase/serverless',
    '@vercel/postgres',
    '@mastra/core',
  ],
  treeshake: true,
  splitting: false,
});
