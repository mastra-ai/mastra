import type { ChannelErrorContext } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';
import { Actions, Card, CardText, LinkButton } from 'chat';

import { readFactorySessionScope } from '../../rules/binding-context.js';
import type { RunErrorRecovery } from '../../run-error.js';
import { describeRunError } from '../../run-error.js';
import { sessionLinkFromRequest } from './channel-session-link-processor.js';

export function slackRunErrorCard(
  error: Error,
  { requestContext }: ChannelErrorContext,
  publicUrl: string | undefined,
) {
  const { title, message, recovery } = describeRunError(error);
  const link = requestContext && recoveryLink(requestContext, recovery, publicUrl);
  return Card({
    title: `❌ ${title}`,
    children: [CardText(message), ...(link ? [Actions([LinkButton(link)])] : [])],
  });
}

function recoveryLink(
  requestContext: RequestContext,
  recovery: RunErrorRecovery | undefined,
  publicUrl: string | undefined,
) {
  const factoryProjectId = readFactorySessionScope(requestContext)?.factoryProjectId;
  if (recovery === 'credentials' && publicUrl && factoryProjectId) {
    const origin = publicUrl.replace(/\/+$/, '');
    return {
      url: `${origin}/factories/${encodeURIComponent(factoryProjectId)}/settings/models`,
      label: 'Review credentials',
    };
  }
  const url = sessionLinkFromRequest(requestContext);
  return url ? { url, label: recovery === 'model' ? 'Change model' : 'Open session' } : undefined;
}
