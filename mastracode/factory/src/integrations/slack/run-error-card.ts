import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { CONTINUE_RUN_ACTION_ID } from '@mastra/core/channels';
import type { ChannelErrorContext } from '@mastra/core/channels';
import { providerRequestId } from '@mastra/core/error';
import type { RequestContext } from '@mastra/core/request-context';
import { Actions, Button, Card, CardText, LinkButton } from 'chat';

import { readFactorySessionScope } from '../../rules/binding-context.js';
import type { RunErrorRecovery } from '../../run-error.js';
import { describeRunError } from '../../run-error.js';
import { runCredential } from '../../session/reply-credential-processor.js';
import { memorySettingsLink, modelSettingsLink } from './channel-reply-processor.js';
import { sessionLinkFromRequest } from './channel-session-link-processor.js';

/** Where a run error card's buttons point: the session's project settings and the session itself. */
export interface RunErrorLinkTarget {
  factoryProjectId?: string;
  sessionUrl?: string;
}

export function slackRunErrorCard(error: Error, { requestContext }: ChannelErrorContext) {
  const target = requestContext && {
    factoryProjectId: readFactorySessionScope(requestContext)?.factoryProjectId,
    sessionUrl: sessionLinkFromRequest(requestContext),
  };
  return runErrorCard(error, { requestContext, target });
}

/** The run error card, for a run's own error or, with `target` from its session, for one posted after it ended. */
export function runErrorCard(
  error: Error,
  { requestContext, target }: { requestContext?: RequestContext; target?: RunErrorLinkTarget },
) {
  const { title, message, recoveries, model } = describeRunError(error);
  const requestId = providerRequestId(error);
  const facts = [model && `Model: ${model}`, requestId && `Request id: ${requestId}`].filter(Boolean).join(' · ');
  const credential = model && recoveries.includes('credentials') ? credentialLine(requestContext, model) : undefined;
  const links = target ? recoveryLinks(target, recoveries) : [];
  // A click continues the run as if the clicker had replied in the thread.
  const retry = recoveries.includes('continue')
    ? [Button({ id: CONTINUE_RUN_ACTION_ID, label: 'Continue', style: 'primary' })]
    : [];
  const buttons = [...retry, ...links.map(link => LinkButton(link))];
  return Card({
    title: `❌ ${title}`,
    children: [
      CardText(message),
      ...(credential ? [CardText(credential, { style: 'muted' })] : []),
      ...(facts ? [CardText(facts, { style: 'muted' })] : []),
      ...(buttons.length ? [Actions(buttons)] : []),
    ],
  });
}

/** Only while the session's model is the one that failed: its provider is what names the credential. */
function credentialLine(requestContext: RequestContext | undefined, failedModel: string): string | undefined {
  const controller = requestContext?.get('controller') as AgentControllerRequestContext | undefined;
  const sessionModelId = controller?.session?.modelId;
  if (!sessionModelId) return undefined;
  const slash = sessionModelId.indexOf('/');
  if (slash <= 0 || (sessionModelId !== failedModel && sessionModelId.slice(slash + 1) !== failedModel))
    return undefined;
  const credential = runCredential(requestContext, sessionModelId.slice(0, slash));
  if (!credential) return undefined;
  return `Runs on ${credential.label} · ${credential.ownerId ? 'Personal credential' : 'Shared by the organization'}`;
}

function recoveryLinks({ factoryProjectId, sessionUrl }: RunErrorLinkTarget, recoveries: RunErrorRecovery[]) {
  const settingsUrl = factoryProjectId && modelSettingsLink(factoryProjectId);
  const memoryUrl = factoryProjectId && memorySettingsLink(factoryProjectId);
  const links = recoveries.flatMap(recovery => {
    switch (recovery) {
      case 'credentials':
        return settingsUrl ? [{ url: settingsUrl, label: 'Review credentials' }] : [];
      case 'model':
        return sessionUrl ? [{ url: sessionUrl, label: 'Change model' }] : [];
      case 'memory_model':
        return memoryUrl ? [{ url: memoryUrl, label: 'Change memory model' }] : [];
      case 'credits':
        return [];
      // A reply in the thread continues the run; a mention in a new thread starts a new session.
      case 'continue':
      case 'new_session':
        return [];
    }
  });
  if (links.length || !sessionUrl) return links;
  return [{ url: sessionUrl, label: 'Open session' }];
}
