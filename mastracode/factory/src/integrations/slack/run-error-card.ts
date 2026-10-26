import type { ChannelErrorContext } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';
import { Actions, Card, CardText, LinkButton } from 'chat';

import { providerRequestId } from '../../provider-error.js';
import { readFactorySessionScope } from '../../rules/binding-context.js';
import type { RunErrorRecovery } from '../../run-error.js';
import { describeRunError } from '../../run-error.js';
import { modelSettingsLink } from './channel-reply-processor.js';
import { sessionLinkFromRequest } from './channel-session-link-processor.js';

export function slackRunErrorCard(error: Error, { requestContext }: ChannelErrorContext) {
  const { title, message, recovery } = describeRunError(error);
  const requestId = providerRequestId(error);
  const link = requestContext && recoveryLink(requestContext, recovery);
  return Card({
    title: `❌ ${title}`,
    children: [
      CardText(message),
      ...(requestId ? [CardText(`Request id: ${requestId}`, { style: 'muted' })] : []),
      ...(link ? [Actions([LinkButton(link)])] : []),
    ],
  });
}

function recoveryLink(requestContext: RequestContext, recovery: RunErrorRecovery | undefined) {
  const factoryProjectId = readFactorySessionScope(requestContext)?.factoryProjectId;
  const settingsUrl = recovery === 'credentials' && factoryProjectId && modelSettingsLink(factoryProjectId);
  if (settingsUrl) return { url: settingsUrl, label: 'Review credentials' };
  const url = sessionLinkFromRequest(requestContext);
  return url ? { url, label: recovery === 'model' ? 'Change model' : 'Open session' } : undefined;
}
