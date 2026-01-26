import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt/Txt';
import { useAgentSettings } from '@/domains/agents/context/agent-context';
import { useEffect, useState } from 'react';
import { Input } from '@/ds/components/Input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { ChevronDown, Braces, CopyIcon, SaveIcon, CheckIcon, SettingsIcon } from 'lucide-react';
import { formatJSON, isValidJson } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Button } from '@/ds/components/Button/Button';

import CodeMirror from '@uiw/react-codemirror';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
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

  return (
    <TooltipProvider>
      <Collapsible
        className="rounded-lg border border-border1 bg-surface2/50 overflow-clip"
        open={isOpen}
        onOpenChange={setIsOpen}
        data-testid="advanced-settings-collapsible"
      >
        <CollapsibleTrigger className="text-neutral6 text-ui-md font-medium flex items-center gap-2.5 w-full px-4 py-3 justify-between hover:bg-surface3/50 transition-colors">
          <span className="flex items-center gap-2">
            <Icon size="sm" className="text-neutral3">
              <SettingsIcon />
            </Icon>
            Advanced Settings
          </span>
          <Icon className={cn('transition-transform duration-200 text-neutral3', isOpen ? 'rotate-0' : '-rotate-90')}>
            <ChevronDown />
          </Icon>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border1 @container/collapsible">
          {/* Numeric Parameters Grid */}
          <div className="p-4 space-y-4">
            <Txt as="h5" variant="ui-sm" className="text-neutral3 uppercase tracking-wider font-medium">
              Generation Limits
            </Txt>
            <div className="grid grid-cols-1 gap-4 @xs/collapsible:grid-cols-2 @md/collapsible:grid-cols-3">
              <div className="space-y-1.5">
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="max-tokens">
                  Max Tokens
                </Txt>
                <Input
                  id="max-tokens"
                  type="number"
                  placeholder="Default"
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

              <div className="space-y-1.5">
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="max-steps">
                  Max Steps
                </Txt>
                <Input
                  id="max-steps"
                  type="number"
                  placeholder="Default"
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

              <div className="space-y-1.5">
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="max-retries">
                  Max Retries
                </Txt>
                <Input
                  id="max-retries"
                  type="number"
                  placeholder="Default"
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
            </div>
          </div>

          {/* Sampling Parameters */}
          <div className="p-4 border-t border-border1 space-y-4">
            <Txt as="h5" variant="ui-sm" className="text-neutral3 uppercase tracking-wider font-medium">
              Sampling Penalties
            </Txt>
            <div className="grid grid-cols-1 gap-4 @xs/collapsible:grid-cols-2 @md/collapsible:grid-cols-3">
              <div className="space-y-1.5">
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="frequency-penalty">
                  Frequency Penalty
                </Txt>
                <Input
                  id="frequency-penalty"
                  type="number"
                  step="0.1"
                  min="-1"
                  max="1"
                  placeholder="-1 to 1"
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

              <div className="space-y-1.5">
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="presence-penalty">
                  Presence Penalty
                </Txt>
                <Input
                  id="presence-penalty"
                  type="number"
                  step="0.1"
                  min="-1"
                  max="1"
                  placeholder="-1 to 1"
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

              <div className="space-y-1.5">
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="top-k">
                  Top K
                </Txt>
                <Input
                  id="top-k"
                  type="number"
                  placeholder="Default"
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

              <div className="space-y-1.5">
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="seed">
                  Seed
                </Txt>
                <Input
                  id="seed"
                  type="number"
                  placeholder="Random"
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
          </div>

          {/* Provider Options JSON Editor */}
          <div className="p-4 border-t border-border1 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <Txt as="label" className="text-neutral6 font-medium" variant="ui-sm" htmlFor="provider-options">
                  Provider Options
                </Txt>
                <Txt as="p" variant="ui-sm" className="text-neutral3 mt-0.5">
                  Custom JSON options passed to the model provider
                </Txt>
              </div>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={formatProviderOptions}
                      className="h-8 w-8 p-0"
                    >
                      <Icon size="sm">
                        <Braces />
                      </Icon>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Format JSON</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0">
                      <Icon size="sm">
                        <CopyIcon />
                      </Icon>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveProviderOptions}
                      className={cn('h-8 w-8 p-0', saved && 'text-accent3')}
                    >
                      <Icon size="sm">{saved ? <CheckIcon /> : <SaveIcon />}</Icon>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{saved ? 'Saved!' : 'Save'}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <CodeMirror
              value={providerOptionsValue}
              onChange={setProviderOptionsValue}
              theme={theme}
              extensions={[jsonLanguage]}
              className="h-[200px] overflow-auto rounded-lg border border-border1 bg-surface1 transition-colors"
            />
            {error && (
              <Txt variant="ui-sm" className="text-accent2 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent2" />
                {error}
              </Txt>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </TooltipProvider>
  );
};
