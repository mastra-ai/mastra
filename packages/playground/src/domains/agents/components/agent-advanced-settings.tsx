import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { FieldBlock, fieldErrorId } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Input } from '@mastra/playground-ui/components/Input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { formatJSON, isValidJson } from '@mastra/playground-ui/utils/formatting';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Braces, CopyIcon, SaveIcon, CheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAgentSettings } from '@/domains/agents/context/agent-context';

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
    const run = async () => {
      if (!isValidJson(providerOptionsStr)) {
        setError('Invalid JSON');
        return;
      }

      const formatted = await formatJSON(providerOptionsStr);
      setProviderOptionsValue(formatted);
    };

    void run();
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
          <div className="space-y-1">
            <FieldBlock.Label name="frequency-penalty" htmlFor="frequency-penalty">
              Frequency Penalty
            </FieldBlock.Label>
            <Input
              id="frequency-penalty"
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
          </div>

          <div className="space-y-1">
            <FieldBlock.Label name="presence-penalty" htmlFor="presence-penalty">
              Presence Penalty
            </FieldBlock.Label>
            <Input
              id="presence-penalty"
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
          </div>

          <div className="space-y-1">
            <FieldBlock.Label name="top-k" htmlFor="top-k">
              Top K
            </FieldBlock.Label>
            <Input
              id="top-k"
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
          </div>

          <div className="space-y-1">
            <FieldBlock.Label name="max-tokens" htmlFor="max-tokens">
              Max Tokens
            </FieldBlock.Label>
            <Input
              id="max-tokens"
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
          </div>

          <div className="space-y-1">
            <FieldBlock.Label name="max-steps" htmlFor="max-steps">
              Max Steps
            </FieldBlock.Label>
            <Input
              id="max-steps"
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
          </div>

          <div className="space-y-1">
            <FieldBlock.Label name="max-retries" htmlFor="max-retries">
              Max Retries
            </FieldBlock.Label>
            <Input
              id="max-retries"
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
          </div>

          <div className="space-y-1">
            <FieldBlock.Label name="seed" htmlFor="seed">
              Seed
            </FieldBlock.Label>
            <Input
              id="seed"
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
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldBlock.Label name="provider-options">Provider Options</FieldBlock.Label>

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
            id="input-provider-options"
            value={providerOptionsValue}
            onChange={setProviderOptionsValue}
            language="json"
            editable={canEdit}
            showCopyButton={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? fieldErrorId('provider-options') : undefined}
            className="h-dropdown-max-height"
          />
          {error && <FieldBlock.ErrorMsg name="provider-options">{error}</FieldBlock.ErrorMsg>}
        </div>
      </div>
    </TooltipProvider>
  );
};
