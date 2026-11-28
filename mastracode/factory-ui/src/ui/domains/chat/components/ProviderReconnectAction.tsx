import { Button } from '@mastra/playground-ui/components/Button';
import { useSessionHost } from '../context/SessionHostContext';

import type { FactoryAuthState } from '../../auth/services/auth';
import { sessionDefaultsAnchor } from '../services/sessionSettings';
import { useChatModelScope } from '../context/useChatModelScope';
import { useChatSessionContext } from '../context/useChatSessionContext';
import type { ThreadOwner } from '../services/reply-credential';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';

function teammatePayingForSession(
  modelScope: 'factory' | 'user' | undefined,
  owner: ThreadOwner | undefined,
  auth: FactoryAuthState | undefined,
): ThreadOwner | undefined {
  if (modelScope !== 'user' || !owner || !auth?.authEnabled) return undefined;
  if (owner.id === auth.user?.userId) return undefined;
  return owner;
}

export function ProviderReconnectAction() {
  const { LinkComponent, links } = useSessionHost();
  const { factoryId, modelScope, scopeLoading } = useChatModelScope();
  const { owner } = useChatSessionContext();
  const authQuery = useSessionHost().data.useViewer();
  const payerUnknown = !factoryId || scopeLoading || authQuery.isPending;
  if (payerUnknown) return null;

  const teammate = teammatePayingForSession(modelScope, owner, authQuery.data);
  if (teammate) return <span>{teammate.name ?? 'The session owner'} needs to reconnect</span>;

  return (
    <Button
      variant="ghost"
      size="sm"
      render={<LinkComponent href={links.settings('models', sessionDefaultsAnchor(modelScope))} returnHere />}
      iconEnd={<IconArrowRight aria-hidden="true" />}
    >
      Review credentials
    </Button>
  );
}
