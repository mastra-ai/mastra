import { jsonLanguage } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { Braces, CopyIcon, SaveIcon, CheckIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { modelProviderOptionsSchema } from './provider-options';
import type { ModelSettingsValues } from './types';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import { Input } from '@/ds/components/Input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { formatJSON, isValidJson } from '@/utils/formatting';

export interface AdvancedModelSettingsProps {
  canEdit?: boolean;
  value: ModelSettingsValues;
  onChange: (value: ModelSettingsValues) => void;
}

export const AdvancedModelSettings = ({ canEdit = true, value, onChange }: AdvancedModelSettingsProps) => {
  const [providerOptionsValue, setProviderOptionsValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingFormat = useRef<AbortController | undefined>(undefined);
  const fieldId = useId();
  const theme = useCodemirrorTheme();

  const { handleCopy } = useCopyToClipboard({ text: providerOptionsValue });

  const providerOptionsStr = JSON.stringify(value.providerOptions ?? {});

  useEffect(() => {
    pendingFormat.current?.abort();
    const controller = new AbortController();
    pendingFormat.current = controller;
    const formatSavedProviderOptions = async () => {
      if (!isValidJson(providerOptionsStr)) {
        setError('Invalid JSON');
        return;
      }

      const formatted = await formatJSON(providerOptionsStr);
      if (!controller.signal.aborted) setProviderOptionsValue(formatted);
    };

    void formatSavedProviderOptions();
    return () => {
      pendingFormat.current?.abort();
    };
  }, [providerOptionsStr]);

  const formatProviderOptions = async () => {
    pendingFormat.current?.abort();
    const controller = new AbortController();
    pendingFormat.current = controller;
    setError(null);
    if (!isValidJson(providerOptionsValue)) {
      setError('Invalid JSON');
      return;
    }
    const formatted = await formatJSON(providerOptionsValue);
    if (!controller.signal.aborted) setProviderOptionsValue(formatted);
  };

  const saveProviderOptions = async () => {
    try {
      setError(null);
      const parsedOptions = modelProviderOptionsSchema.safeParse(JSON.parse(providerOptionsValue));
      if (!parsedOptions.success) {
        setError('Provider options must be an object of provider objects');
        return;
      }
      onChange({ ...value, providerOptions: parsedOptions.data });
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 1000);
    } catch (error) {
      console.error('error', error);
      setError('Invalid JSON');
    }
  };

  const buttonClass = 'text-neutral3 hover:text-neutral6';

  return (
    <TooltipProvider>
      <div className="@container/advanced">
        <div className="grid grid-cols-1 gap-2 pb-2 @xs/advanced:grid-cols-2">
          <div className="space-y-1">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-frequency-penalty`}>
              Frequency Penalty
            </Txt>
            <Input
              id={`${fieldId}-frequency-penalty`}
              type="number"
              step="0.1"
              min="-1"
              max="1"
              readOnly={!canEdit}
              value={value.frequencyPenalty ?? ''}
              onChange={e =>
                onChange({ ...value, frequencyPenalty: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>

          <div className="space-y-1">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-presence-penalty`}>
              Presence Penalty
            </Txt>
            <Input
              id={`${fieldId}-presence-penalty`}
              type="number"
              step="0.1"
              min="-1"
              max="1"
              readOnly={!canEdit}
              value={value.presencePenalty ?? ''}
              onChange={e =>
                onChange({ ...value, presencePenalty: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>

          <div className="space-y-1">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-top-k`}>
              Top K
            </Txt>
            <Input
              id={`${fieldId}-top-k`}
              type="number"
              readOnly={!canEdit}
              value={value.topK ?? ''}
              onChange={e => onChange({ ...value, topK: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="space-y-1">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-max-tokens`}>
              Max Tokens
            </Txt>
            <Input
              id={`${fieldId}-max-tokens`}
              type="number"
              readOnly={!canEdit}
              value={value.maxTokens ?? ''}
              onChange={e => onChange({ ...value, maxTokens: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="space-y-1">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-max-steps`}>
              Max Steps
            </Txt>
            <Input
              id={`${fieldId}-max-steps`}
              type="number"
              readOnly={!canEdit}
              value={value.maxSteps ?? ''}
              onChange={e => onChange({ ...value, maxSteps: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="space-y-1">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-max-retries`}>
              Max Retries
            </Txt>
            <Input
              id={`${fieldId}-max-retries`}
              type="number"
              readOnly={!canEdit}
              value={value.maxRetries ?? ''}
              onChange={e => onChange({ ...value, maxRetries: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="space-y-1">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-seed`}>
              Seed
            </Txt>
            <Input
              id={`${fieldId}-seed`}
              type="number"
              readOnly={!canEdit}
              value={value.seed ?? ''}
              onChange={e => onChange({ ...value, seed: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Txt as="label" className="text-neutral3" variant="ui-sm" htmlFor={`${fieldId}-provider-options`}>
              Provider Options
            </Txt>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={formatProviderOptions}
                      className={buttonClass}
                      aria-label="Format Provider Options"
                    />
                  }
                >
                  <Icon>
                    <Braces />
                  </Icon>
                </TooltipTrigger>
                <TooltipContent>Format the Provider Options JSON</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={buttonClass}
                      aria-label="Copy Provider Options"
                    />
                  }
                >
                  <Icon>
                    <CopyIcon />
                  </Icon>
                </TooltipTrigger>
                <TooltipContent>Copy Provider Options</TooltipContent>
              </Tooltip>

              {canEdit && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={saveProviderOptions}
                        className={buttonClass}
                        aria-label="Save Provider Options"
                      />
                    }
                  >
                    <Icon>{saved ? <CheckIcon /> : <SaveIcon />}</Icon>
                  </TooltipTrigger>
                  <TooltipContent>{saved ? 'Saved' : 'Save Provider Options'}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <CodeMirror
            id={`${fieldId}-provider-options`}
            aria-label="Provider Options"
            value={providerOptionsValue}
            onChange={(draft: string) => {
              pendingFormat.current?.abort();
              setProviderOptionsValue(draft);
            }}
            theme={theme}
            extensions={[jsonLanguage, EditorView.contentAttributes.of({ 'aria-label': 'Provider Options' })]}
            readOnly={!canEdit}
            className="h-dropdown-max-height overflow-scroll rounded-lg border bg-transparent p-2 shadow-sm transition-colors"
          />
          {error && (
            <Txt variant="ui-md" className="text-accent2" role="alert">
              {error}
            </Txt>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
