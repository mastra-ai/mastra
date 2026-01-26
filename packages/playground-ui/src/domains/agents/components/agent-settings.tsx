import { Slider } from '@/ds/components/Slider';

import { Label } from '@/ds/components/Label';

import { RefreshCw, Info } from 'lucide-react';

import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';

import { Entry } from '@/ds/components/Entry';
import { useAgentSettings } from '../context/agent-context';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt/Txt';

import { AgentAdvancedSettings } from './agent-advanced-settings';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/ds/components/Tooltip';
import { Switch } from '@/ds/components/Switch';
import { cn } from '@/lib/utils';
import { useAgent } from '../hooks/use-agent';
import { useMemory } from '@/domains/memory/hooks/use-memory';
import { Skeleton } from '@/ds/components/Skeleton';
import { useSamplingRestriction } from '../hooks/use-sampling-restriction';

export interface AgentSettingsProps {
  agentId: string;
}

const NetworkCheckbox = ({
  hasMemory,
  hasSubAgents,
  isSelected,
}: {
  hasMemory: boolean;
  hasSubAgents: boolean;
  isSelected: boolean;
}) => {
  const isNetworkAvailable = hasMemory && hasSubAgents;

  const radio = (
    <label
      htmlFor="network"
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150',
        isSelected ? 'border-accent1 bg-accent1/5 shadow-sm' : 'border-border1 hover:border-border2 hover:bg-surface2',
        !isNetworkAvailable && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:border-border1',
      )}
    >
      <RadioGroupItem value="network" id="network" className="text-neutral6" disabled={!isNetworkAvailable} />
      <Label
        className={cn('text-neutral6 text-ui-md cursor-pointer', !isNetworkAvailable && '!text-neutral3 cursor-not-allowed')}
        htmlFor="network"
      >
        Network
      </Label>
    </label>
  );

  if (isNetworkAvailable) {
    return radio;
  }

  const requirements = [];
  if (!hasMemory) {
    requirements.push('memory enabled');
  }
  if (!hasSubAgents) {
    requirements.push('at least one sub-agent');
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{radio}</TooltipTrigger>
      <TooltipContent>
        <p>Network is not available. Please make sure you have {requirements.join(' and ')}.</p>
      </TooltipContent>
    </Tooltip>
  );
};

export const AgentSettings = ({ agentId }: AgentSettingsProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { settings, setSettings, resetAll } = useAgentSettings();

  const { hasSamplingRestriction } = useSamplingRestriction({
    provider: agent?.provider,
    modelId: agent?.modelId,
    settings,
    setSettings,
  });

  if (isLoading || isMemoryLoading) {
    return <Skeleton className="h-full" />;
  }

  if (!agent) {
    return <div>Agent not found</div>;
  }

  const hasMemory = Boolean(memory?.result);
  const hasSubAgents = Boolean(Object.keys(agent.agents || {}).length > 0);
  const modelVersion = agent.modelVersion;
  const isSupportedModel = modelVersion === 'v2' || modelVersion === 'v3';

  let radioValue;

  if (isSupportedModel) {
    if (settings?.modelSettings?.chatWithNetwork) {
      radioValue = 'network';
    } else {
      radioValue = settings?.modelSettings?.chatWithGenerate ? 'generate' : 'stream';
    }
  } else {
    radioValue = settings?.modelSettings?.chatWithGenerateLegacy ? 'generateLegacy' : 'streamLegacy';
  }

  return (
    <TooltipProvider>
      <div className="px-5 text-xs py-2 pb-4" data-testid="agent-settings">
        <section className="@container">
          {/* Chat Method - Card-like selection */}
          <Entry
            label="Chat Method"
            description="How the agent processes and responds to messages"
            className="pb-5"
          >
            <RadioGroup
              orientation="horizontal"
              value={radioValue}
              onValueChange={(value: string) =>
                setSettings({
                  ...settings,
                  modelSettings: {
                    ...settings?.modelSettings,
                    chatWithGenerateLegacy: value === 'generateLegacy',
                    chatWithGenerate: value === 'generate',
                    chatWithNetwork: value === 'network',
                  },
                })
              }
              className="flex flex-col gap-2 @xs:flex-row @xs:gap-3 mt-3"
            >
              {!isSupportedModel && (
                <label
                  htmlFor="generateLegacy"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150',
                    radioValue === 'generateLegacy'
                      ? 'border-accent1 bg-accent1/5 shadow-sm'
                      : 'border-border1 hover:border-border2 hover:bg-surface2',
                  )}
                >
                  <RadioGroupItem value="generateLegacy" id="generateLegacy" className="text-neutral6" />
                  <Label className="text-neutral6 text-ui-md cursor-pointer" htmlFor="generateLegacy">
                    Generate (Legacy)
                  </Label>
                </label>
              )}
              {isSupportedModel && (
                <label
                  htmlFor="generate"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150',
                    radioValue === 'generate'
                      ? 'border-accent1 bg-accent1/5 shadow-sm'
                      : 'border-border1 hover:border-border2 hover:bg-surface2',
                  )}
                >
                  <RadioGroupItem value="generate" id="generate" className="text-neutral6" />
                  <Label className="text-neutral6 text-ui-md cursor-pointer" htmlFor="generate">
                    Generate
                  </Label>
                </label>
              )}
              {!isSupportedModel && (
                <label
                  htmlFor="streamLegacy"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150',
                    radioValue === 'streamLegacy'
                      ? 'border-accent1 bg-accent1/5 shadow-sm'
                      : 'border-border1 hover:border-border2 hover:bg-surface2',
                  )}
                >
                  <RadioGroupItem value="streamLegacy" id="streamLegacy" className="text-neutral6" />
                  <Label className="text-neutral6 text-ui-md cursor-pointer" htmlFor="streamLegacy">
                    Stream (Legacy)
                  </Label>
                </label>
              )}
              {isSupportedModel && (
                <label
                  htmlFor="stream"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150',
                    radioValue === 'stream'
                      ? 'border-accent1 bg-accent1/5 shadow-sm'
                      : 'border-border1 hover:border-border2 hover:bg-surface2',
                  )}
                >
                  <RadioGroupItem value="stream" id="stream" className="text-neutral6" />
                  <Label className="text-neutral6 text-ui-md cursor-pointer" htmlFor="stream">
                    Stream
                  </Label>
                </label>
              )}
              {isSupportedModel && <NetworkCheckbox hasMemory={hasMemory} hasSubAgents={hasSubAgents} isSelected={radioValue === 'network'} />}
            </RadioGroup>
          </Entry>

          {/* Toggle Settings Section */}
          <div className="border-t border-border1 pt-4 mt-1">
            <Entry
              label="Require Tool Approval"
              description="Pause execution to approve tool calls before running"
              layout="inline"
            >
              <Switch
                checked={settings?.modelSettings?.requireToolApproval ?? false}
                onCheckedChange={value =>
                  setSettings({
                    ...settings,
                    modelSettings: { ...settings?.modelSettings, requireToolApproval: value },
                  })
                }
                data-testid="tool-approval-switch"
              />
            </Entry>
          </div>

          {/* Sampling Parameters Section */}
          <div className="border-t border-border1 pt-5 mt-4">
            <Txt as="h4" variant="ui-md" className="text-neutral6 font-medium mb-4">
              Sampling Parameters
            </Txt>

            {hasSamplingRestriction &&
              (settings?.modelSettings?.temperature !== undefined || settings?.modelSettings?.topP !== undefined) && (
                <div className="flex items-start gap-2.5 text-xs text-neutral3 bg-surface2 rounded-lg px-3 py-2.5 mb-4 border border-border1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-accent4" />
                  <span>
                    {settings?.modelSettings?.temperature !== undefined
                      ? 'Claude 4.5+ models only accept Temperature OR Top P. Clear Temperature to use Top P.'
                      : 'Claude 4.5+ models only accept Temperature OR Top P. Setting Temperature will clear Top P.'}
                  </span>
                </div>
              )}

            <div className="grid grid-cols-1 @xs:grid-cols-2 gap-6">
              <Entry label="Temperature" description="Controls randomness (0 = focused, 1 = creative)">
                <div className="flex flex-row justify-between items-center gap-3 mt-1">
                  <Slider
                    value={[settings?.modelSettings?.temperature ?? -0.1]}
                    max={1}
                    min={-0.1}
                    step={0.1}
                    onValueChange={value =>
                      setSettings({
                        ...settings,
                        modelSettings: { ...settings?.modelSettings, temperature: value[0] < 0 ? undefined : value[0] },
                      })
                    }
                  />
                  <Txt
                    as="span"
                    variant="ui-sm"
                    className={cn(
                      'min-w-[32px] text-right font-mono tabular-nums',
                      settings?.modelSettings?.temperature !== undefined ? 'text-neutral6' : 'text-neutral3',
                    )}
                  >
                    {settings?.modelSettings?.temperature ?? 'n/a'}
                  </Txt>
                </div>
              </Entry>

              <Entry label="Top P" description="Nucleus sampling threshold">
                <div className="flex flex-row justify-between items-center gap-3 mt-1">
                  <Slider
                    onValueChange={value =>
                      setSettings({
                        ...settings,
                        modelSettings: { ...settings?.modelSettings, topP: value[0] < 0 ? undefined : value[0] },
                      })
                    }
                    value={[settings?.modelSettings?.topP ?? -0.1]}
                    max={1}
                    min={-0.1}
                    step={0.1}
                  />
                  <Txt
                    as="span"
                    variant="ui-sm"
                    className={cn(
                      'min-w-[32px] text-right font-mono tabular-nums',
                      settings?.modelSettings?.topP !== undefined ? 'text-neutral6' : 'text-neutral3',
                    )}
                  >
                    {settings?.modelSettings?.topP ?? 'n/a'}
                  </Txt>
                </div>
              </Entry>
            </div>
          </div>
        </section>

        <section className="py-5 border-t border-border1 mt-5">
          <AgentAdvancedSettings />
        </section>

        <Button onClick={() => resetAll()} variant="light" className="w-full" size="lg">
          <Icon>
            <RefreshCw />
          </Icon>
          Reset All Settings
        </Button>
      </div>
    </TooltipProvider>
  );
};
