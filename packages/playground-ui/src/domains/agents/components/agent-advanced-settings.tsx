import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt/Txt';
import { useAgentSettings } from '@/domains/agents/context/agent-context';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Braces, CopyIcon, SaveIcon, CheckIcon } from 'lucide-react';
import { formatJSON, isValidJson } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import CodeMirror from '@uiw/react-codemirror';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { jsonLanguage } from '@codemirror/lang-json';

export const AgentAdvancedSettings = () => {
  const { settings, setSettings } = useAgentSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [providerOptionsValue, setProviderOptionsValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = useCodemirrorTheme();

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

    run();
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

  const collapsibleClassName = 'rounded-lg border-sm border-border1 bg-surface3 overflow-clip';
  const collapsibleTriggerClassName =
    'text-icon3 text-ui-lg font-medium flex items-center gap-2 w-full p-[10px] justify-between';
  const collapsibleContentClassName = 'bg-surface2 p-[10px] grid grid-cols-2 gap-[10px]';
  const buttonClass = 'text-icon3 hover:text-icon6';

  return (
    <TooltipProvider>
      <Collapsible className={collapsibleClassName} open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className={collapsibleTriggerClassName}>
          Advanced Settings
          <Icon className={cn('transition-transform', isOpen ? 'rotate-0' : '-rotate-90')}>
            <ChevronDown />
          </Icon>
        </CollapsibleTrigger>
        <CollapsibleContent className={collapsibleContentClassName}>
          <div className="space-y-1">
            <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="top-k">
              Top K
            </Txt>
            <Input
              id="top-k"
              type="number"
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
            <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="frequency-penalty">
              Frequency Penalty
            </Txt>
            <Input
              id="frequency-penalty"
              type="number"
              value={settings?.modelSettings?.frequencyPenalty || ''}
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
            <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="presence-penalty">
              Presence Penalty
            </Txt>
            <Input
              id="presence-penalty"
              type="number"
              value={settings?.modelSettings?.presencePenalty || ''}
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
            <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="max-tokens">
              Max Tokens
            </Txt>
            <Input
              id="max-tokens"
              type="number"
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
            <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="max-steps">
              Max Steps
            </Txt>
            <Input
              id="max-steps"
              type="number"
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
            <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="max-retries">
              Max Retries
            </Txt>
            <Input
              id="max-retries"
              type="number"
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

          <div className="space-y-1 col-span-2">
            <div className="flex justify-between items-center">
              <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="provider-options">
                Provider Options
              </Txt>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={formatProviderOptions} className={buttonClass}>
                      <Icon>
                        <Braces />
                      </Icon>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Format the Provider Options JSON</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={handleCopy} className={buttonClass}>
                      <Icon>
                        <CopyIcon />
                      </Icon>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copy Provider Options</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={saveProviderOptions} className={buttonClass}>
                      <Icon>{saved ? <CheckIcon /> : <SaveIcon />}</Icon>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{saved ? 'Saved' : 'Save Provider Options'}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <CodeMirror
              value={providerOptionsValue}
              onChange={setProviderOptionsValue}
              theme={theme}
              extensions={[jsonLanguage]}
              className="h-[300px] overflow-scroll rounded-lg border bg-transparent shadow-sm transition-colors p-2"
            />
            {error && (
              <Txt variant="ui-md" className="text-accent2">
                {error}
              </Txt>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </TooltipProvider>
  );
};
