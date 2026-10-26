import type { ChannelErrorContext } from '@mastra/core/channels';
import { Actions, Card, CardText, LinkButton } from 'chat';

import { getFactorySessionCoordinates } from '../../rules/binding-context.js';
import type { RunErrorRecovery } from '../../run-error.js';
import { describeRunError } from '../../run-error.js';
import { factorySessionUrl } from '../../session-url.js';
import type { FactoryRunBindingSessionAddress } from '../../storage/domains/work-items/base.js';

export function slackRunErrorCard(error: Error, { requestContext }: ChannelErrorContext, publicUrl: string | undefined) {
  const { title, message, recovery } = describeRunError(error);
  const session = getFactorySessionCoordinates(requestContext);
  const link = publicUrl && session ? recoveryLink(publicUrl, session, recovery) : undefined;
  return Card({
    title: `❌ ${title}`,
    children: [CardText(message), ...(link ? [Actions([LinkButton(link)])] : [])],
  });
}

function recoveryLink(publicUrl: string, session: FactoryRunBindingSessionAddress, recovery: RunErrorRecovery | undefined) {
  if (recovery === 'credentials') {
    const origin = publicUrl.replace(/\/+$/, '');
    return {
      url: `${origin}/factories/${encodeURIComponent(session.factoryProjectId)}/settings/models`,
      label: 'Review credentials',
    };
  }
  return {
    url: factorySessionUrl(publicUrl, session),
    label: recovery === 'model' ? 'Change model' : 'Open session',
  };
}
