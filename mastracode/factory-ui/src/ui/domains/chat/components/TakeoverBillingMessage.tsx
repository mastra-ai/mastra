import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ModelCatalogEntry } from '@mastra/factory/routes/config';
import { resolveModel } from '@mastra/playground-ui/utils/model';
import { Link } from 'react-router';

import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import type { SessionModelCatalog } from '../../../../hooks/useSessionModelCatalog';
import { MODEL_DEFAULTS_ANCHORS, SETTINGS_SECTION_LABELS, settingsSectionPath } from '../../settings/settingsSections';
import { useChatModels } from '../context/useChatModels';
import { useChatModelScope } from '../context/useChatModelScope';

type TakeoverBilling =
  | { kind: 'unknown' }
  | { kind: 'factory' }
  | { kind: 'missing'; provider: string; modelName: string }
  | { kind: 'credential'; model: ModelCatalogEntry; modelName: string };

function takeoverBilling({
  modelScope,
  activeModelId,
  yourModels,
}: {
  modelScope: SessionModelCatalog['modelScope'];
  activeModelId: string | undefined;
  yourModels: ModelCatalogEntry[] | undefined;
}): TakeoverBilling {
  if (modelScope === 'factory') return { kind: 'factory' };
  if (modelScope !== 'user' || !activeModelId || !yourModels) return { kind: 'unknown' };
  const { provider, modelName } = resolveModel(activeModelId);
  if (!provider) return { kind: 'unknown' };
  const model = yourModels.find(candidate => candidate.id === activeModelId);
  if (!model) return { kind: 'missing', provider, modelName };
  return { kind: 'credential', model, modelName };
}

function paidByMessage({ model, modelName }: { model: ModelCatalogEntry; modelName: string }, ownerLabel: string) {
  const credential = model.credentialLabel ?? `${providerDisplayName(model.provider)} connection`;
  switch (model.credentialHolder) {
    case 'organization':
      return `The organization’s ${credential} keeps paying, on the same ${modelName}.`;
    case 'deployment':
      return `The server’s ${credential} keeps paying, on the same ${modelName}.`;
    default:
      return `Your ${credential} pays from your next message, on the same ${modelName}. This session is cached on ${ownerLabel}’s account, so that reply re-reads all of it and costs more.`;
  }
}

export function TakeoverBillingMessage({ factoryId, ownerLabel }: { factoryId: string; ownerLabel: string }) {
  const { activeModelId } = useChatModels();
  const { modelScope } = useChatModelScope();
  const yourModels = useAvailableModelsQuery({ scope: 'user', enabled: modelScope === 'user' }).data;
  const billing = takeoverBilling({ modelScope, activeModelId, yourModels });

  if (billing.kind === 'factory') {
    return 'The Factory keeps paying, and the model stays the same.';
  }
  if (billing.kind === 'unknown') return 'Its next message runs as you.';
  if (billing.kind === 'missing') {
    return (
      <>
        You have no {providerDisplayName(billing.provider)} connection, so {billing.modelName} can’t run for you.
        Connect one in{' '}
        <Link
          to={settingsSectionPath(factoryId, 'models', MODEL_DEFAULTS_ANCHORS.personal)}
          className="underline underline-offset-2"
        >
          {SETTINGS_SECTION_LABELS.models}
        </Link>
        , or pick another model once it’s yours.
      </>
    );
  }
  return paidByMessage(billing, ownerLabel);
}
