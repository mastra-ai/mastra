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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ds/components/Tooltip';
import clsx from 'clsx';
import { Checkbox } from '@/ds/components/Checkbox';
import { useAgent } from '../hooks/use-agent';
import { useMemory } from '@/domains/memory/hooks/use-memory';
import { Skeleton } from '@/ds/components/Skeleton';
import { useSamplingRestriction } from '../hooks/use-sampling-restriction';

export interface AgentSettingsProps {
  agentId: string;
}

const NetworkCheckbox = ({ hasMemory, hasSubAgents }: { hasMemory: boolean; hasSubAgents: boolean }) => {
  const isNetworkAvailable = hasMemory && hasSubAgents;

  const radio = (
    <div className="flex items-center gap-2">
      <RadioGroupItem value="network" id="network" className="text-neutral6" disabled={!isNetworkAvailable} />
      <Label
        className={clsx('text-neutral6 text-ui-md', !isNetworkAvailable && '!text-neutral3 cursor-not-allowed')}
        htmlFor="network"
      >
        Network
      </Label>
    </div>
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
    <div className="px-5 text-xs py-2 pb-4">
      <section className="space-y-7 @container">
        <Entry label="Chat Method">
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
            className="flex flex-col gap-4 @xs:flex-row"
          >
            {!isSupportedModel && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="generateLegacy" id="generateLegacy" className="text-neutral6" />
                <Label className="text-neutral6 text-ui-md" htmlFor="generateLegacy">
                  Generate (Legacy)
                </Label>
              </div>
            )}
            {isSupportedModel && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="generate" id="generate" className="text-neutral6" />
                <Label className="text-neutral6 text-ui-md" htmlFor="generate">
                  Generate
                </Label>
              </div>
            )}
            {!isSupportedModel && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="streamLegacy" id="streamLegacy" className="text-neutral6" />
                <Label className="text-neutral6 text-ui-md" htmlFor="streamLegacy">
                  Stream (Legacy)
                </Label>
              </div>
            )}
            {isSupportedModel && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="stream" id="stream" className="text-neutral6" />
                <Label className="text-neutral6 text-ui-md" htmlFor="stream">
                  Stream
                </Label>
              </div>
            )}
            {isSupportedModel && <NetworkCheckbox hasMemory={hasMemory} hasSubAgents={hasSubAgents} />}
          </RadioGroup>
        </Entry>
        <Entry label="Require Tool Approval">
          <Checkbox
            checked={settings?.modelSettings?.requireToolApproval}
            onCheckedChange={value =>
              setSettings({
                ...settings,
                modelSettings: { ...settings?.modelSettings, requireToolApproval: value as boolean },
              })
            }
          />
        </Entry>

        {hasSamplingRestriction &&
          (settings?.modelSettings?.temperature !== undefined || settings?.modelSettings?.topP !== undefined) && (
            <div className="flex items-center gap-2 text-xs text-neutral3 bg-surface3 rounded px-3 py-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {settings?.modelSettings?.temperature !== undefined
                  ? 'Claude 4.5+ models only accept Temperature OR Top P. Clear Temperature to use Top P.'
                  : 'Claude 4.5+ models only accept Temperature OR Top P. Setting Temperature will clear Top P.'}
              </span>
            </div>
          )}

        <div className="grid grid-cols-1 @xs:grid-cols-2 gap-8">
          <Entry label="Temperature">
            <div className="flex flex-row justify-between items-center gap-2">
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
              <Txt as="p" variant="ui-sm" className="text-neutral3">
                {settings?.modelSettings?.temperature ?? 'n/a'}
              </Txt>
            </div>
          </Entry>

          <Entry label="Top P">
            <div className="flex flex-row justify-between items-center gap-2">
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

              <Txt as="p" variant="ui-sm" className="text-neutral3">
                {settings?.modelSettings?.topP ?? 'n/a'}
              </Txt>
            </div>
          </Entry>
        </div>
      </section>

      <section className="py-7">
        <AgentAdvancedSettings />
      </section>

      <Button onClick={() => resetAll()} variant="light" className="w-full" size="lg">
        <Icon>
          <RefreshCw />
        </Icon>
        Reset
      </Button>
    </div>
  );
};
