import * as p from '@clack/prompts';
import color from 'picocolors';

import { DOCKER_DATABASE_URL } from '../context.js';
import type { CreateContext } from '../context.js';

const DB_DOCS_URL = 'https://mastra.ai/docs/software-factory/database';

export function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

/**
 * Database step. Integrations (GitHub/Linear) and shared agent state need
 * Postgres with pgvector; without it the app still boots (local libSQL).
 */
export async function databaseStep(
  ctx: CreateContext,
  preset: { dbUrl?: string; useDefaults?: boolean },
): Promise<void> {
  if (preset.dbUrl) {
    if (!isPostgresUrl(preset.dbUrl)) {
      throw new Error(`--db-url must be a postgres:// URL (got ${preset.dbUrl})`);
    }
    ctx.env.set('APP_DATABASE_URL', preset.dbUrl);
    ctx.databaseConfigured = true;
    ctx.analytics.trackEvent('sf_database_selected', { choice: 'url_flag' });
    return;
  }

  if (preset.useDefaults) {
    ctx.env.set('APP_DATABASE_URL', DOCKER_DATABASE_URL);
    ctx.databaseConfigured = true;
    ctx.dockerDatabase = true;
    ctx.analytics.trackEvent('sf_database_selected', { choice: 'docker_default' });
    return;
  }

  p.log.message(
    `${color.bold('Database')} — GitHub/Linear integrations and shared agent state need Postgres ${color.dim('(with the pgvector extension)')}.`,
  );

  const choice = await p.select({
    message: 'How do you want to set up the database?',
    options: [
      {
        value: 'docker',
        label: 'Local Postgres via Docker (recommended)',
        hint: 'uses the bundled docker-compose.yml — requires Docker',
      },
      { value: 'url', label: 'I have a Postgres URL', hint: 'Neon, Supabase, Railway, RDS, self-hosted, ...' },
      { value: 'skip', label: 'Skip for now', hint: 'agents still work; integrations stay off' },
    ],
    initialValue: 'docker',
  });

  if (p.isCancel(choice) || choice === 'skip') {
    ctx.followUps.push(`Set APP_DATABASE_URL in .env to enable integrations — see ${DB_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_database_selected', { choice: 'skipped' });
    p.log.info('Skipping the database — integrations stay off, agent state uses a local file.');
    return;
  }

  if (choice === 'docker') {
    ctx.env.set('APP_DATABASE_URL', DOCKER_DATABASE_URL);
    ctx.databaseConfigured = true;
    ctx.dockerDatabase = true;
    ctx.analytics.trackEvent('sf_database_selected', { choice: 'docker' });
    p.log.success(`Database configured — run ${color.cyan(`${ctx.packageManager} run db:up`)} to start it (Docker).`);
    return;
  }

  const dbUrl = await p.text({
    message: 'Postgres connection URL',
    placeholder: 'postgres://user:pass@host:5432/dbname',
    validate: value => {
      if (!value?.trim()) return 'Enter a URL (or press Ctrl+C to skip)';
      if (!isPostgresUrl(value.trim())) return 'Must be a postgres:// or postgresql:// URL';
      return undefined;
    },
  });

  if (p.isCancel(dbUrl)) {
    ctx.followUps.push(`Set APP_DATABASE_URL in .env to enable integrations — see ${DB_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_database_selected', { choice: 'skipped' });
    return;
  }

  ctx.env.set('APP_DATABASE_URL', dbUrl.trim());
  ctx.databaseConfigured = true;
  ctx.analytics.trackEvent('sf_database_selected', { choice: 'url' });
  p.log.success(`Database configured. Make sure pgvector is available — see ${color.underline(DB_DOCS_URL)}`);
}
