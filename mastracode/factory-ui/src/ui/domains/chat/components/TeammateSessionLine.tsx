import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ModelCatalogEntry } from '@mastra/factory/routes/config';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { resolveModel } from '@mastra/playground-ui/utils/model';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { settingsSectionPath } from '../../settings/settingsSections';
import { useTakeSessionOwnership } from '../../workspaces/hooks/useTakeSessionOwnership';
import { useChatModels } from '../context/useChatModels';
import { useChatModelScope } from '../context/useChatModelScope';

function billingAfterTakeover(model: ModelCatalogEntry, modelName: string): string {
  const credential = model.credentialLabel ?? `${providerDisplayName(model.provider)} connection`;
  if (model.credentialHolder === 'organization') {
    return `Billing stays on the organization’s ${credential}, still on ${modelName}. A running agent stops.`;
  }
  if (model.credentialHolder === 'deployment') {
    return `Billing stays on the server’s ${credential}, still on ${modelName}. A running agent stops.`;
  }
  return `Billing moves to your ${credential}, still on ${modelName}. A running agent stops, and the next turn re-reads the whole thread without the prompt cache.`;
}

function TakeoverEffects({ factoryId }: { factoryId: string }) {
  const { activeModelId } = useChatModels();
  const { modelScope } = useChatModelScope();
  const yourModels = useAvailableModelsQuery({ scope: 'user', enabled: modelScope === 'user' }).data;

  if (modelScope === 'factory') return <>Billing stays on the organization’s credentials, and a running agent stops.</>;
  const sessionModel = activeModelId ? resolveModel(activeModelId) : undefined;
  if (modelScope !== 'user' || !yourModels || !sessionModel?.provider) {
    return <>Its next turn runs as you, and a running agent stops.</>;
  }
  const yourModel = yourModels.find(model => model.id === activeModelId);
  if (yourModel) return <>{billingAfterTakeover(yourModel, sessionModel.modelName)}</>;
  return (
    <>
      You have no {providerDisplayName(sessionModel.provider)} connection, so connect one in{' '}
      <Link to={settingsSectionPath(factoryId, 'personal-models')} className="underline underline-offset-2">
        Your models
      </Link>{' '}
      or pick another model before its next turn. A running agent stops.
    </>
  );
}

export function TeammateSessionLine() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId?: string; sessionId?: string; threadId?: string }>();
  const session = useUserSessionQuery(sessionId ?? threadId).data;
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  const takeOwnership = useTakeSessionOwnership(factoryId);
  const [confirming, setConfirming] = useState(false);
  if (!session || !viewerUserId || session.userId === viewerUserId) return null;

  const owner = session.owner;
  const ownersSession = `${owner ? `${owner.name}’s` : 'a teammate’s'} session`;
  const canTakeOwnership = session.capabilities?.takeOwnership === true;
  if (confirming && canTakeOwnership && factoryId) {
    return (
      <Notice
        variant="warning"
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              autoFocus
              disabled={takeOwnership.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={takeOwnership.isPending}
              onClick={() =>
                takeOwnership.mutate(
                  { sessionId: session.sessionId, expectedOwnerId: session.userId },
                  { onSettled: () => setConfirming(false) },
                )
              }
            >
              Take ownership
            </Button>
          </div>
        }
      >
        <Notice.Message>
          Take {ownersSession}? <TakeoverEffects factoryId={factoryId} />
        </Notice.Message>
      </Notice>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-3">
      {owner && (
        <div aria-hidden="true">
          <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />
        </div>
      )}
      <Txt as="p" variant="caption" tone="muted" className="truncate">
        You’re steering {ownersSession}
      </Txt>
      {canTakeOwnership && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => setConfirming(true)}
        >
          Take ownership
        </Button>
      )}
    </div>
  );
}
