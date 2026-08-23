import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useTitleGenerationQuery, useUpdateTitleGenerationMutation } from '../../../../hooks/use-title-generation';
import type { TitleGenerationConfigInfo } from '../../../../api/types';

import { ModelCombobox } from './ModelCombobox';
import { Segmented, THINKING_LEVELS } from './SettingsPanel.parts';
import { SettingsRow } from './SettingsCard';

/** Sentinel for "no thinking-level override — the model's default applies". */
const USE_MODEL_DEFAULT = '__default__';

/** Server defaults, applied when the config cannot be loaded (e.g. older API). */
const FALLBACK_CONFIG: TitleGenerationConfigInfo = { enabled: true, modelId: null, thinkingLevel: null };

function useTitleGenerationSection() {
  const configQuery = useTitleGenerationQuery();
  const update = useUpdateTitleGenerationMutation();
  const error = update.error ?? configQuery.error;
  const config = configQuery.data ?? (configQuery.isError ? FALLBACK_CONFIG : undefined);
  return { config, update, error };
}

/**
 * Automatic thread titles. When on, the first message of an untitled thread
 * fires a cheap side-model request that names it; threads that already carry
 * a title (work items, review sessions, manual renames) are never touched,
 * and a disabled or failing generation leaves the fallback names in place.
 */
export function TitleGenerationSection({ models }: { models: AvailableModelOption[] }) {
  const { config, update, error } = useTitleGenerationSection();
  const disabled = !config || update.isPending;

  return (
    <>
      {error && (
        <Txt as="p" variant="ui-xs" className="text-notice-destructive-fg px-4 pt-3">
          {error instanceof Error ? error.message : String(error)}
        </Txt>
      )}
      <SettingsRow
        label="Thread titles"
        hint="Name new threads automatically from their first message, using a cheap side model."
      >
        <Segmented
          ariaLabel="Automatic thread titles"
          value={config?.enabled ? 'on' : 'off'}
          disabled={disabled}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={value => update.mutate({ enabled: value === 'on' })}
        />
      </SettingsRow>
      {config?.enabled && (
        <>
          <SettingsRow label="Title model" hint="Unset uses the cheap default for the first connected provider.">
            <div className="flex w-full max-w-72 items-center gap-2">
              {update.isPending && <Spinner size="sm" aria-label="Saving title model" className="text-icon3 shrink-0" />}
              <label className="min-w-0 flex-1">
                <span className="sr-only">Thread title model</span>
                <ModelCombobox
                  models={models}
                  value={config.modelId ?? ''}
                  placeholder="Default"
                  disabled={disabled}
                  onValueChange={value => update.mutate({ modelId: value })}
                />
              </label>
              {config.modelId && (
                <button
                  type="button"
                  className={buttonVariants({ variant: 'ghost' })}
                  disabled={disabled}
                  onClick={() => update.mutate({ modelId: null })}
                >
                  Reset
                </button>
              )}
            </div>
          </SettingsRow>
          <SettingsRow label="Title thinking level" hint="Reasoning effort for the title request">
            <Segmented
              ariaLabel="Thread title thinking level"
              value={config.thinkingLevel ?? USE_MODEL_DEFAULT}
              disabled={disabled}
              options={[{ value: USE_MODEL_DEFAULT, label: 'Default' }, ...THINKING_LEVELS]}
              onChange={value => update.mutate({ thinkingLevel: value === USE_MODEL_DEFAULT ? null : value })}
            />
          </SettingsRow>
        </>
      )}
    </>
  );
}
