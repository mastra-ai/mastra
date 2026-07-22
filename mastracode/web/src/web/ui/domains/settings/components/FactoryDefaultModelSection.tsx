import { Txt } from '@mastra/playground-ui/components/Txt';

import type { AvailableModelOption } from '../../../../../shared/hooks/useAvailableModels';
import {
  useFactoryProjectQuery,
  useSetFactoryDefaultModelMutation,
} from '../../../../../shared/hooks/useFactoryDefaultModel';
import { useActiveFactoryContext } from '../../workspaces/context/ActiveFactoryProvider';
import { isServerFactory } from '../../workspaces/services/factories';
import { ModelCombobox } from './ModelCombobox';

const SESSION_DEFAULT_OPTION = [{ label: 'Session default', value: '' }];

/**
 * Factory default model. Server-backed Factories persist a default model on
 * the Factory project itself; factory runs (issue triage, board work items)
 * start on it. Renders nothing for local-folder factories — they have no
 * server-side project to carry the setting.
 */
export function FactoryDefaultModelSection({ models }: { models: AvailableModelOption[] }) {
  const { activeFactory } = useActiveFactoryContext();
  const factoryProjectId =
    activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined;
  const projectQuery = useFactoryProjectQuery(factoryProjectId);
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryProjectId);

  if (!factoryProjectId) return null;

  const defaultModelId = projectQuery.data?.defaultModelId ?? '';
  const error = setDefaultModel.error ?? projectQuery.error;

  return (
    <div className="flex items-center justify-between gap-4 py-3 not-last:border-b not-last:border-border1/40">
      <div className="flex flex-col">
        <Txt as="span" variant="ui-md">
          Factory default model
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Factory runs (triage, board work items) start on this model
        </Txt>
        {error && (
          <Txt as="span" variant="ui-xs" className="text-notice-destructive-fg">
            {error instanceof Error ? error.message : String(error)}
          </Txt>
        )}
      </div>
      <label className="w-full max-w-72">
        <span className="sr-only">Factory default model</span>
        <ModelCombobox
          models={models}
          value={defaultModelId}
          placeholder="Session default"
          leadingOptions={SESSION_DEFAULT_OPTION}
          disabled={projectQuery.isPending || setDefaultModel.isPending}
          onValueChange={value => setDefaultModel.mutate(value || null)}
        />
      </label>
    </div>
  );
}
