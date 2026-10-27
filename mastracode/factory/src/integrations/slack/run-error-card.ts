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
  const { title, message, recoveries, model } = describeRunError(error);
  const requestId = providerRequestId(error);
  const facts = [model && `Model: ${model}`, requestId && `Request id: ${requestId}`].filter(Boolean).join(' · ');
  const links = requestContext ? recoveryLinks(requestContext, recoveries) : [];
  return Card({
    title: `❌ ${title}`,
    children: [
      CardText(message),
      ...(facts ? [CardText(facts, { style: 'muted' })] : []),
      ...(links.length ? [Actions(links.map(link => LinkButton(link)))] : []),
    ],
  });
}

function recoveryLinks(requestContext: RequestContext, recoveries: RunErrorRecovery[]) {
  const factoryProjectId = readFactorySessionScope(requestContext)?.factoryProjectId;
  const settingsUrl = factoryProjectId && modelSettingsLink(factoryProjectId);
  const sessionUrl = sessionLinkFromRequest(requestContext);
  const links = recoveries.flatMap(recovery => {
    if (recovery === 'credentials') return settingsUrl ? [{ url: settingsUrl, label: 'Review credentials' }] : [];
    return sessionUrl ? [{ url: sessionUrl, label: 'Change model' }] : [];
  });
  if (links.length || !sessionUrl) return links;
  return [{ url: sessionUrl, label: 'Open session' }];
}
