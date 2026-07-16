import * as p from '@clack/prompts';
import color from 'picocolors';

import type { CreateContext } from '../context.js';

const LINEAR_DOCS_URL = 'https://mastra.ai/docs/software-factory/linear';

/**
 * Optional Linear intake step (requires database + WorkOS). The user creates
 * a Linear OAuth app and pastes its credentials.
 */
export async function linearStep(ctx: CreateContext): Promise<void> {
  const setup = await p.confirm({
    message: `Connect Linear for issue intake? ${color.dim('(optional)')}`,
    initialValue: false,
  });

  if (p.isCancel(setup) || !setup) {
    ctx.analytics.trackEvent('sf_linear_configured', { configured: false });
    return;
  }

  p.log.message(
    [
      `Create a Linear OAuth app (~1 minute):`,
      `  1. Linear → Settings → API → OAuth applications → ${color.bold('New')}`,
      `  2. Callback URL: ${color.cyan(`${ctx.publicUrl}/auth/linear/callback`)}`,
      `  3. Copy the ${color.bold('Client ID')} and ${color.bold('Client secret')}`,
      `Guide: ${color.underline(LINEAR_DOCS_URL)}`,
    ].join('\n'),
  );

  const clientId = await p.text({
    message: 'Linear Client ID',
    validate: value => (value?.trim() ? undefined : 'Required'),
  });
  if (p.isCancel(clientId)) {
    ctx.followUps.push(`Connect Linear later: set LINEAR_CLIENT_ID + LINEAR_CLIENT_SECRET — see ${LINEAR_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_linear_configured', { configured: false });
    return;
  }

  const clientSecret = await p.password({ message: 'Linear Client secret' });
  if (p.isCancel(clientSecret) || !clientSecret?.trim()) {
    ctx.followUps.push(`Connect Linear later: set LINEAR_CLIENT_ID + LINEAR_CLIENT_SECRET — see ${LINEAR_DOCS_URL}`);
    ctx.analytics.trackEvent('sf_linear_configured', { configured: false });
    return;
  }

  ctx.env.set('LINEAR_CLIENT_ID', clientId.trim());
  ctx.env.set('LINEAR_CLIENT_SECRET', clientSecret.trim());
  ctx.linearConfigured = true;
  ctx.analytics.trackEvent('sf_linear_configured', { configured: true });
  p.log.success('Linear configured — connect your workspace from the web UI (Settings › Intake).');
}
