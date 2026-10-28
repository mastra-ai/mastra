import type { ChannelErrorContext } from '@mastra/core/channels';
import { providerRequestId } from '@mastra/core/error';
import type { RequestContext } from '@mastra/core/request-context';
import { Actions, Card, CardText, LinkButton } from 'chat';

import { readFactorySessionScope } from '../../rules/binding-context.js';
import type { RunErrorRecovery } from '../../run-error.js';
import { describeRunError } from '../../run-error.js';
import { runCredential } from '../../session/reply-credential-processor.js';
import { modelSettingsLink } from './channel-reply-processor.js';
import { sessionLinkFromRequest } from './channel-session-link-processor.js';

export function slackRunErrorCard(error: Error, { requestContext }: ChannelErrorContext) {
  const { title, message, recoveries, model } = describeRunError(error);
  const requestId = providerRequestId(error);
  const facts = [model && `Model: ${model}`, requestId && `Request id: ${requestId}`].filter(Boolean).join(' · ');
  const credential = model && recoveries.includes('credentials') ? credentialLine(requestContext, model) : undefined;
  const links = requestContext ? recoveryLinks(requestContext, recoveries) : [];
  return Card({
    title: `❌ ${title}`,
    children: [
      CardText(message),
      ...(credential ? [CardText(credential, { style: 'muted' })] : []),
      ...(facts ? [CardText(facts, { style: 'muted' })] : []),
      ...(links.length ? [Actions(links.map(link => LinkButton(link)))] : []),
    ],
  });
}

/** Only while the session's model is the one that failed: its provider is what names the credential. */
function credentialLine(requestContext: RequestContext | undefined, failedModel: string): string | undefined {
  const controller = requestContext?.get('controller') as { getState?: () => { currentModelId?: unknown } } | undefined;
  const currentModelId = controller?.getState?.().currentModelId;
  if (typeof currentModelId !== 'string') return undefined;
  const slash = currentModelId.indexOf('/');
  if (slash <= 0 || (currentModelId !== failedModel && currentModelId.slice(slash + 1) !== failedModel))
    return undefined;
  const credential = runCredential(requestContext, currentModelId.slice(0, slash));
  if (!credential) return undefined;
  return `Runs on ${credential.label} · ${credential.ownerId ? 'Personal credential' : 'Shared by the organization'}`;
}

function recoveryLinks(requestContext: RequestContext, recoveries: RunErrorRecovery[]) {
  const factoryProjectId = readFactorySessionScope(requestContext)?.factoryProjectId;
  const settingsUrl = factoryProjectId && modelSettingsLink(factoryProjectId);
  const sessionUrl = sessionLinkFromRequest(requestContext);
  const links = recoveries.flatMap(recovery => {
    switch (recovery) {
      case 'credentials':
        return settingsUrl ? [{ url: settingsUrl, label: 'Review credentials' }] : [];
      case 'model':
        return sessionUrl ? [{ url: sessionUrl, label: 'Change model' }] : [];
      // A reply in the thread continues the run; a mention in a new thread starts a new session.
      case 'continue':
      case 'new_session':
        return [];
    }
  });
  if (links.length || !sessionUrl) return links;
  return [{ url: sessionUrl, label: 'Open session' }];
}
