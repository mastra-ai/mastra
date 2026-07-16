import { randomBytes } from 'node:crypto';
import * as p from '@clack/prompts';
import color from 'picocolors';

import type { CreateContext } from '../context.js';

const AUTH_DOCS_URL = 'https://mastra.ai/docs/software-factory/auth';

/**
 * WorkOS auth step. Sign-in is the prerequisite for the GitHub/Linear
 * integrations (they are per-organization). Skippable — the app runs
 * auth-less locally without it.
 */
export async function workosStep(ctx: CreateContext): Promise<void> {
  p.log.message(
    [
      `${color.bold('Sign-in (WorkOS)')} — integrations are per-organization, so GitHub/Linear require`,
      `sign-in, powered by WorkOS (free tier works). Setup takes ~2 minutes:`,
      `  1. Create an app at ${color.underline('https://dashboard.workos.com')}`,
      `  2. Copy the ${color.bold('API key')} (sk_...) and ${color.bold('Client ID')} (client_...)`,
      `  3. Under Redirects, add ${color.cyan(`${ctx.publicUrl}/auth/callback`)}`,
      `Guide: ${color.underline(AUTH_DOCS_URL)}`,
    ].join('\n'),
  );

  const setup = await p.confirm({
    message: 'Set up WorkOS sign-in now?',
    initialValue: ctx.databaseConfigured,
  });

  if (p.isCancel(setup) || !setup) {
    ctx.followUps.push(`Enable sign-in later: set WORKOS_API_KEY + WORKOS_CLIENT_ID — see ${AUTH_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_workos_configured', { configured: false });
    return;
  }

  const apiKey = await p.password({ message: 'WorkOS API key (sk_...)' });
  if (p.isCancel(apiKey) || !apiKey?.trim()) {
    ctx.followUps.push(`Enable sign-in later: set WORKOS_API_KEY + WORKOS_CLIENT_ID — see ${AUTH_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_workos_configured', { configured: false });
    return;
  }

  const clientId = await p.text({
    message: 'WorkOS Client ID (client_...)',
    validate: value => (value?.trim() ? undefined : 'Required — find it in the WorkOS dashboard'),
  });
  if (p.isCancel(clientId)) {
    ctx.followUps.push(`Enable sign-in later: set WORKOS_API_KEY + WORKOS_CLIENT_ID — see ${AUTH_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_workos_configured', { configured: false });
    return;
  }

  ctx.env.set('WORKOS_API_KEY', apiKey.trim());
  ctx.env.set('WORKOS_CLIENT_ID', clientId.trim());
  // Random 32+ char secret: seals session cookies AND serves as the
  // replica-stable OAuth state secret required by the Linear feature.
  ctx.env.set('WORKOS_COOKIE_PASSWORD', randomBytes(32).toString('hex'));
  ctx.workosConfigured = true;
  ctx.analytics.trackEvent('sf_workos_configured', { configured: true });
  p.log.success('WorkOS sign-in configured (session secret generated).');
}
