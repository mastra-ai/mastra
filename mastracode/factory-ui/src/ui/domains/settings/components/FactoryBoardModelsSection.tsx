import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { useParams } from 'react-router';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useFactoryProjectQuery, useSetFactoryBoardModelMutation } from '../../../../hooks/useFactoryDefaultModel';
import { FACTORY_DEFAULT_MODEL_VALUE, ModelCombobox } from './ModelCombobox';
import { SharedCredentialNotice } from './SharedCredentialNotice';

const ROWS = [
  {
    field: 'workModelId' as const,
    label: 'Work sessions',
    description: 'Work-board runs (triage, plan, execute). Unset follows the Factory default.',
  },
  {
    field: 'reviewModelId' as const,
    label: 'Review sessions',
    description: 'Pull request and merge request review-board runs. Unset follows the Factory default.',
  },
];

export function FactoryBoardModelsSection({ models }: { models: AvailableModelOption[] }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setBoardModel = useSetFactoryBoardModelMutation(factoryId);

  if (!factoryId) return null;

  return (
    <>
      {ROWS.map(row => {
        const stored = projectQuery.data?.[row.field] ?? null;
        const value = stored ?? FACTORY_DEFAULT_MODEL_VALUE;
        const error = setBoardModel.error ?? projectQuery.error;
        return (
          <SettingsRow
            key={row.field}
            variant="factory"
            label={row.label}
            description={
              <>
                <span>{row.description}</span>
                {error && (
                  <Txt as="span" variant="ui-xs" className="text-notice-destructive-fg">
                    {error instanceof Error ? error.message : String(error)}
                  </Txt>
                )}
                <SharedCredentialNotice modelId={stored || undefined} />
              </>
            }
          >
            <div className="flex w-full max-w-72 items-center gap-2">
              {setBoardModel.isPending && setBoardModel.variables?.field === row.field && (
                <Spinner size="sm" aria-label={`Saving ${row.label} model`} className="text-icon3 shrink-0" />
              )}
              <label className="min-w-0 flex-1">
                <span className="sr-only">{row.label}</span>
                <ModelCombobox
                  models={models}
                  value={value}
                  clearOptionLabel="Use Factory default"
                  placeholder="Use Factory default"
                  disabled={projectQuery.isPending || setBoardModel.isPending}
                  onValueChange={next =>
                    setBoardModel.mutate({
                      field: row.field,
                      modelId: next === FACTORY_DEFAULT_MODEL_VALUE ? null : next,
                    })
                  }
                />
              </label>
            </div>
          </SettingsRow>
        );
      })}
    </>
  );
}
