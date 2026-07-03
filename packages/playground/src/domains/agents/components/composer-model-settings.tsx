import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Entry } from '@mastra/playground-ui/components/Entry';
import { Label } from '@mastra/playground-ui/components/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Slider } from '@mastra/playground-ui/components/Slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Info, Sliders } from 'lucide-react';
import { useState } from 'react';

import { useAgentSettings } from '../context/agent-context';
import { useAgent } from '../hooks/use-agent';
import { useSamplingRestriction } from '../hooks/use-sampling-restriction';
import { AgentAdvancedSettingsBody } from './agent-advanced-settings';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useMemory } from '@/domains/memory/hooks/use-memory';

export interface ComposerModelSettingsProps {
  agentId: string;
}

interface NetworkRadioProps {
  hasMemory: boolean;
  hasSubAgents: boolean;
  disabled: boolean;
}

const NetworkRadio = ({ hasMemory, hasSubAgents, disabled }: NetworkRadioProps) => {
  const isNetworkAvailable = hasMemory && hasSubAgents;
  const itemDisabled = disabled || !isNetworkAvailable;

  const radio = (
    <div className="flex items-center gap-2">
      <RadioGroupItem value="network" id="network" className="text-neutral6" disabled={itemDisabled} />
      <Label
        className={cn('text-neutral6 text-ui-md', !isNetworkAvailable && 'text-neutral3! cursor-not-allowed')}
        htmlFor="network"
      >
        Network
      </Label>
    </div>
  );

  if (isNetworkAvailable) {
    return radio;
  }

  const requirements: string[] = [];
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

interface StreamSubscriptionRadioProps {
  supported: boolean;
  disabled: boolean;
}

const StreamSubscriptionRadio = ({ supported, disabled }: StreamSubscriptionRadioProps) => {
  const itemDisabled = disabled || !supported;

  const radio = (
    <div className="flex items-center gap-2">
      <RadioGroupItem
        value="streamSubscription"
        id="streamSubscription"
        className="text-neutral6"
        disabled={itemDisabled}
      />
      <Label
        className={cn('text-neutral6 text-ui-md', !supported && 'text-neutral3! cursor-not-allowed')}
        htmlFor="streamSubscription"
      >
        Stream subscription (default)
      </Label>
    </div>
  );

  if (supported) {
    return radio;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{radio}</TooltipTrigger>
      <TooltipContent>
        <p>Stream subscription is not supported for this agent.</p>
      </TooltipContent>
    </Tooltip>
  );
};

export const ComposerModelSettings = ({ agentId }: ComposerModelSettingsProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { settings, setSettings, resetAll } = useAgentSettings();
  const { canEdit } = usePermissions();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const canEditSettings = canEdit('agents');

  const { hasSamplingRestriction } = useSamplingRestriction({
    provider: agent?.provider,
    modelId: agent?.modelId,
    settings,
    setSettings,
  });

  if (!isLoading && !agent) {
    return null;
  }

  const hasMemory = Boolean(memory?.result);
  const hasSubAgents = Boolean(agent && Object.keys(agent.agents || {}).length > 0);
  const modelVersion = agent?.modelVersion;
  const isSupportedModel = modelVersion === 'v2' || modelVersion === 'v3';
  const supportsThreadSubscription = agent?.supportsMemory !== false;

  let radioValue: string | undefined;

  if (agent) {
    if (isSupportedModel) {
      if (settings?.modelSettings?.chatWithNetwork) {
        radioValue = 'network';
      } else if (settings?.modelSettings?.chatWithGenerate) {
        radioValue = 'generate';
      } else if (settings?.modelSettings?.chatWithLegacyStream || !supportsThreadSubscription) {
        radioValue = 'stream';
      } else {
        radioValue = 'streamSubscription';
      }
    } else {
      radioValue = settings?.modelSettings?.chatWithGenerateLegacy ? 'generateLegacy' : 'streamLegacy';
    }
  }

  const showSamplingBanner =
    hasSamplingRestriction &&
    (settings?.modelSettings?.temperature !== undefined || settings?.modelSettings?.topP !== undefined);

  return (
    <>
      <Popover
        open={popoverOpen}
        onOpenChange={(open, details) => {
          // While the Advanced Settings dialog is open, ignore every popover
          // dismissal — outside-press, close button, focus loss, etc. The
          // dialog owns its own close lifecycle and is the only thing that
          // can dismiss the popover indirectly (by being closed first).
          if (!open && advancedOpen) {
            details?.cancel?.();
            return;
          }
          setPopoverOpen(open);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="default"
            size="icon-md"
            type="button"
            tooltip="Model settings"
            data-testid="composer-model-settings-trigger"
          >
            <Sliders className="h-5 w-5 text-neutral3 hover:text-neutral6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-4">
          {isLoading || isMemoryLoading ? (
            <Skeleton className="h-40 w-full" data-testid="composer-model-settings-skeleton" />
          ) : (
            <section className="space-y-5 @container">
              <Entry label="Chat Method">
                <RadioGroup
                  value={radioValue}
                  disabled={!canEditSettings}
                  onValueChange={(value: string) =>
                    canEditSettings &&
                    setSettings({
                      ...settings,
                      modelSettings: {
                        ...settings?.modelSettings,
                        chatWithGenerateLegacy: value === 'generateLegacy',
                        chatWithGenerate: value === 'generate',
                        chatWithLegacyStream: value === 'stream',
                        chatWithNetwork: value === 'network',
                      },
                    })
                  }
                  className="flex flex-col gap-3"
                >
                  {!isSupportedModel && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="generateLegacy"
                        id="generateLegacy"
                        className="text-neutral6"
                        disabled={!canEditSettings}
                      />
                      <Label className="text-neutral6 text-ui-md" htmlFor="generateLegacy">
                        Generate (Legacy)
                      </Label>
                    </div>
                  )}
                  {isSupportedModel && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="generate"
                        id="generate"
                        className="text-neutral6"
                        disabled={!canEditSettings}
                      />
                      <Label className="text-neutral6 text-ui-md" htmlFor="generate">
                        Generate
                      </Label>
                    </div>
                  )}
                  {!isSupportedModel && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="streamLegacy"
                        id="streamLegacy"
                        className="text-neutral6"
                        disabled={!canEditSettings}
                      />
                      <Label className="text-neutral6 text-ui-md" htmlFor="streamLegacy">
                        Stream (Legacy)
                      </Label>
                    </div>
                  )}
                  {isSupportedModel && (
                    <StreamSubscriptionRadio supported={supportsThreadSubscription} disabled={!canEditSettings} />
                  )}
                  {isSupportedModel && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="stream"
                        id="stream"
                        className="text-neutral6"
                        disabled={!canEditSettings}
                      />
                      <Label className="text-neutral6 text-ui-md" htmlFor="stream">
                        Stream
                      </Label>
                    </div>
                  )}
                  {isSupportedModel && (
                    <NetworkRadio hasMemory={hasMemory} hasSubAgents={hasSubAgents} disabled={!canEditSettings} />
                  )}
                </RadioGroup>
              </Entry>

              <Entry label="Require Tool Approval">
                <Checkbox
                  checked={settings?.modelSettings?.requireToolApproval}
                  disabled={!canEditSettings}
                  onCheckedChange={value =>
                    canEditSettings &&
                    setSettings({
                      ...settings,
                      modelSettings: { ...settings?.modelSettings, requireToolApproval: value as boolean },
                    })
                  }
                />
              </Entry>

              {showSamplingBanner && (
                <div
                  className="flex items-center gap-2 text-xs text-neutral3 bg-surface3 rounded px-3 py-2"
                  data-testid="sampling-restriction-banner"
                >
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {settings?.modelSettings?.temperature !== undefined
                      ? 'Claude 4.5+ models only accept Temperature OR Top P. Clear Temperature to use Top P.'
                      : 'Claude 4.5+ models only accept Temperature OR Top P. Setting Temperature will clear Top P.'}
                  </span>
                </div>
              )}

              <Entry label="Temperature">
                <div className="flex flex-row justify-between items-center gap-2">
                  <Slider
                    value={[settings?.modelSettings?.temperature ?? -0.1]}
                    max={1}
                    min={-0.1}
                    step={0.1}
                    disabled={!canEditSettings}
                    onValueChange={value =>
                      canEditSettings &&
                      setSettings({
                        ...settings,
                        modelSettings: {
                          ...settings?.modelSettings,
                          temperature: value[0] < 0 ? undefined : value[0],
                        },
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
                    disabled={!canEditSettings}
                    onValueChange={value =>
                      canEditSettings &&
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

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={!canEditSettings}
                  onClick={() => canEditSettings && resetAll()}
                >
                  Reset
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  type="button"
                  disabled={!canEditSettings}
                  onClick={() => setAdvancedOpen(true)}
                >
                  Advanced Settings
                </Button>
              </div>
            </section>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Advanced model settings</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <AgentAdvancedSettingsBody canEdit={canEditSettings} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
