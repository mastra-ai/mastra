import { randomBytes } from 'node:crypto';
import * as p from '@clack/prompts';
import color from 'picocolors';

import type { CreateContext } from '../context.js';

// Setup guidance lives in the generated project README (same content as the
// template repo README) until dedicated docs pages ship.
const GITHUB_DOCS_URL = 'https://github.com/mastra-ai/softwarefactory-template#github';

/**
 * Optional GitHub connection step (requires database + WorkOS). Guides the
 * user through creating a GitHub App by hand and collects its credentials —
 * the same guided env-collection pattern as the Linear step.
 */
export async function githubAppStep(ctx: CreateContext): Promise<void> {
  const setup = await p.confirm({
    message: `Connect GitHub? ${color.dim('(optional)')}`,
    initialValue: true,
  });

  if (p.isCancel(setup) || !setup) {
    ctx.followUps.push(`Connect GitHub later: set the GITHUB_APP_* vars in .env — see ${GITHUB_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_github_configured', { configured: false, mode: 'skipped' });
    return;
  }

  p.log.message(
    [
      `Create a GitHub App (~2 minutes):`,
      `  1. ${color.cyan('https://github.com/settings/apps/new')} ${color.dim('(or your org: github.com/organizations/<org>/settings/apps/new)')}`,
      `  2. Callback URL: ${color.cyan(`${ctx.publicUrl}/auth/github/callback`)}`,
      `  3. Permissions: ${color.bold('Contents')}, ${color.bold('Issues')}, ${color.bold('Pull requests')} → Read & write; ${color.bold('Metadata')} → Read-only`,
      `  4. Webhook: ${color.bold('uncheck Active')} ${color.dim('(local installs have no public URL; enable later on a public host)')}`,
      `  5. After creating: generate a ${color.bold('client secret')} and a ${color.bold('private key')} (.pem download)`,
      `Guide: ${color.underline(GITHUB_DOCS_URL)}`,
    ].join('\n'),
  );

  const fields: Array<{ key: string; label: string; secret?: boolean }> = [
    { key: 'GITHUB_APP_ID', label: 'App ID' },
    { key: 'GITHUB_APP_CLIENT_ID', label: 'Client ID' },
    { key: 'GITHUB_APP_CLIENT_SECRET', label: 'Client secret', secret: true },
    { key: 'GITHUB_APP_SLUG', label: 'App slug (from the app URL)' },
    { key: 'GITHUB_APP_PRIVATE_KEY', label: 'Private key (paste PEM contents)', secret: true },
  ];
  // Buffer the credentials locally and only stage them into the env once the
  // whole form succeeds — cancelling midway must leave the env untouched.
  const collected: Record<string, string> = {};
  for (const field of fields) {
    const value = field.secret
      ? await p.password({ message: field.label })
      : await p.text({ message: field.label, validate: v => (v?.trim() ? undefined : 'Required') });
    if (p.isCancel(value) || !String(value ?? '').trim()) {
      ctx.followUps.push(`Finish GitHub setup: set the GITHUB_APP_* vars in .env — see ${GITHUB_DOCS_URL}`);
      ctx.analytics.trackEvent('sf_github_configured', { configured: false, mode: 'manual' });
      return;
    }
    collected[field.key] = String(value).trim();
  }
  for (const [key, value] of Object.entries(collected)) {
    ctx.env.set(key, value);
  }
  ctx.env.set('GITHUB_APP_WEBHOOK_SECRET', randomBytes(24).toString('hex'));
  ctx.githubConfigured = true;
  ctx.analytics.trackEvent('sf_github_configured', { configured: true, mode: 'manual' });
  p.log.success('GitHub App configured. After first sign-in, install the app on your repos from the web UI.');
  ctx.followUps.push(
    `Optional (needs a public host): enable webhooks for auto-triage/PR notifications — add ` +
      `<public-url>/web/github/webhook with the GITHUB_APP_WEBHOOK_SECRET from .env in the GitHub App settings, ` +
      `then subscribe to issues, issue_comment, and pull_request events — see ${GITHUB_DOCS_URL}`,
  );
}
