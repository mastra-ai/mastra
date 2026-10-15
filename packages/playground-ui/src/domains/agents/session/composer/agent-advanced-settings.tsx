import { Braces, CopyIcon, SaveIcon, CheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAgentSettings } from '@/domains/agents/session/context/agent-context';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Field, FieldError, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/utils/cn';
import { formatJSON, isValidJson } from '@/utils/formatting';

export interface AgentAdvancedSettingsBodyProps {
  canEdit?: boolean;
}

export const AgentAdvancedSettingsBody = ({ canEdit = true }: AgentAdvancedSettingsBodyProps) => {
  const { settings, setSettings } = useAgentSettings();
  const [providerOptionsValue, setProviderOptionsValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { handleCopy } = useCopyToClipboard({ text: providerOptionsValue });

  const providerOptionsStr = JSON.stringify(settings?.modelSettings?.providerOptions ?? {});

  useEffect(() => {
    let isCanceled = false;
    const run = async () => {
      if (!isValidJson(providerOptionsStr)) {
        setError('Invalid JSON');
        return;
      }

      const formatted = await formatJSON(providerOptionsStr);
      if (isCanceled) return;
      setError(null);
      setProviderOptionsValue(formatted);
    };

    void run();
    return () => {
      isCanceled = true;
    };
  }, [providerOptionsStr]);

  const formatProviderOptions = async () => {
    setError(null);
    if (!isValidJson(providerOptionsValue)) {
      setError('Invalid JSON');
      return;
    }
    const formatted = await formatJSON(providerOptionsValue);
    setProviderOptionsValue(formatted);
  };

  const saveProviderOptions = async () => {
    try {
      setError(null);
      const parsedContext = JSON.parse(providerOptionsValue);
      setSettings({
        ...settings,
        modelSettings: {
          ...settings?.modelSettings,
          providerOptions: parsedContext,
        },
      });
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 1000);
    } catch (error) {
      console.error('error', error);
      setError('Invalid JSON');
    }
  };

  const buttonClass = cn(quietTextHover, controlStateColorTransition);

  return (
    <TooltipProvider>
      <div className="@container/advanced">
        <div className="grid grid-cols-1 gap-2 pb-2 @xs/advanced:grid-cols-2">
          <Field>
            <FieldLabel>Frequency Penalty</FieldLabel>
            <Input
              type="number"
              step="0.1"
              min="-1"
              max="1"
              readOnly={!canEdit}
              value={settings?.modelSettings?.frequencyPenalty ?? ''}
              onChange={e =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    frequencyPenalty: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </Field>

          <Field>
            <FieldLabel>Presence Penalty</FieldLabel>
            <Input
              type="number"
              step="0.1"
              min="-1"
              max="1"
              readOnly={!canEdit}
              value={settings?.modelSettings?.presencePenalty ?? ''}
              onChange={e =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    presencePenalty: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </Field>

          <Field>
            <FieldLabel>Top K</FieldLabel>
            <Input
              type="number"
              readOnly={!canEdit}
              value={settings?.modelSettings?.topK || ''}
              onChange={e =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    topK: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </Field>

          <Field>
            <FieldLabel>Max Tokens</FieldLabel>
            <Input
              type="number"
              readOnly={!canEdit}
              value={settings?.modelSettings?.maxTokens || ''}
              onChange={e =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    maxTokens: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </Field>

          <Field>
            <FieldLabel>Max Steps</FieldLabel>
            <Input
              type="number"
              readOnly={!canEdit}
              value={settings?.modelSettings?.maxSteps || ''}
              onChange={e =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    maxSteps: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </Field>

          <Field>
            <FieldLabel>Max Retries</FieldLabel>
            <Input
              type="number"
              readOnly={!canEdit}
              value={settings?.modelSettings?.maxRetries || ''}
              onChange={e =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    maxRetries: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </Field>

          <Field>
            <FieldLabel>Seed</FieldLabel>
            <Input
              type="number"
              readOnly={!canEdit}
              value={settings?.modelSettings?.seed || ''}
              onChange={e =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    seed: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </Field>
        </div>

        <Field invalid={Boolean(error)} className="gap-1">
          <div className="flex items-center justify-between">
            <FieldLabel>Provider Options</FieldLabel>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={formatProviderOptions}
                    className={buttonClass}
                    aria-label="Format Provider Options"
                  >
                    <Icon>
                      <Braces />
                    </Icon>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Format the Provider Options JSON</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={handleCopy} className={buttonClass} aria-label="Copy Provider Options">
                    <Icon>
                      <CopyIcon />
                    </Icon>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy Provider Options</TooltipContent>
              </Tooltip>

              {canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={saveProviderOptions}
                      className={buttonClass}
                      aria-label="Save Provider Options"
                    >
                      <Icon>{saved ? <CheckIcon /> : <SaveIcon />}</Icon>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{saved ? 'Saved' : 'Save Provider Options'}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <CodeEditor
            value={providerOptionsValue}
            onChange={setProviderOptionsValue}
            language="json"
            editable={canEdit}
            showCopyButton={false}
            className="h-75"
          />
          <FieldError>{error}</FieldError>
        </Field>
      </div>
    </TooltipProvider>
  );
};
