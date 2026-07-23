import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useAvailableModelsQuery } from '../../../../../shared/hooks/useAvailableModels';
import {
  useFactoryProjectQuery,
  useSetFactoryDefaultModelMutation,
} from '../../../../../shared/hooks/useFactoryDefaultModel';
import { ModelCombobox } from '../../settings/components/ModelCombobox';
import { ProviderAccessSection } from '../../settings/components/ProviderAccessSection';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

export interface ModelFactoryStepProps {
  factoryId: string;
  onContinue: () => void;
}

/**
 * Combined wizard step used by both factory wizards (onboarding and
 * /factories/create): connect a model provider credential, then pick the
 * Factory default model. The pick saves immediately to the factory project's
 * `defaultModelId`; Continue only unlocks once the server confirms a saved
 * model, so OAuth roundtrips and refreshes re-derive completion from state.
 */
export function ModelFactoryStep({ factoryId, onContinue }: ModelFactoryStepProps) {
  const modelsQuery = useAvailableModelsQuery();
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryId);

  const models = modelsQuery.data ?? [];
  const defaultModelId = projectQuery.data?.defaultModelId ?? '';
  const error = setDefaultModel.error ?? projectQuery.error ?? modelsQuery.error;

  return (
    <section aria-label="Model connection" className="max-w-xl rounded-2xl border border-border1 bg-surface2/80 p-5">
      <div className="flex flex-col gap-5">
        <ProviderAccessSection />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Txt as="span" variant="ui-md" className="text-icon5">
              Default model
            </Txt>
            {setDefaultModel.isPending && (
              <Spinner size="sm" aria-label="Saving default model" className="shrink-0 text-icon3" />
            )}
          </div>
          <label>
            <span className="sr-only">Factory default model</span>
            <ModelCombobox
              models={models}
              value={defaultModelId}
              placeholder="Select a model"
              disabled={projectQuery.isPending || setDefaultModel.isPending}
              onValueChange={value => setDefaultModel.mutate(value)}
            />
          </label>
          {!modelsQuery.isPending && models.length === 0 && (
            <Txt as="span" variant="ui-sm" className="text-icon3">
              Connect a provider to see models.
            </Txt>
          )}
          {error && (
            <Txt as="span" variant="ui-sm" role="alert" className="text-notice-destructive-fg">
              {error instanceof Error ? error.message : String(error)}
            </Txt>
          )}
        </div>

        <Button variant="primary" disabled={!defaultModelId} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </section>
  );
}
