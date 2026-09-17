import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { ComposerModelSettingsButton } from '@mastra/playground-ui/components/Composer';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Entry } from '@mastra/playground-ui/components/Entry';
import { Label } from '@mastra/playground-ui/components/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Slider } from '@mastra/playground-ui/components/Slider';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Info, Settings2, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';

import { useAgentSettings } from '../context/agent-context';
import { useAgent } from '../hooks/use-agent';
import { useSamplingRestriction } from '../hooks/use-sampling-restriction';
import { AgentAdvancedSettingsBody } from './agent-advanced-settings';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useMemory } from '@/domains/memory/hooks/use-memory';

export interface ComposerModelSettingsProps {
  agentId: string;
}

export const ComposerModelSettings = ({ agentId }: ComposerModelSettingsProps) => {
  const methodId = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { settings, setSettings, resetAll } = useAgentSettings();
  const { canEdit } = usePermissions();

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

  const networkRequirements = [!hasMemory && 'memory enabled', !hasSubAgents && 'at least one sub-agent'].filter(
    Boolean,
  );
  const methods: ModelSettingsMethod[] = isSupportedModel
    ? [
        { value: 'generate', label: 'Generate' },
        {
          value: 'streamSubscription',
          label: 'Stream subscription (default)',
          unavailable: supportsThreadSubscription ? undefined : 'Stream subscription is not supported for this agent.',
        },
        { value: 'stream', label: 'Stream' },
        {
          value: 'network',
          label: 'Network',
          unavailable: networkRequirements.length
            ? `Network is not available. Please make sure you have ${networkRequirements.join(' and ')}.`
            : undefined,
        },
      ]
    : [
        { value: 'generateLegacy', label: 'Generate (Legacy)' },
        { value: 'streamLegacy', label: 'Stream (Legacy)' },
      ];
  const samplingNotice =
    settings?.modelSettings?.temperature !== undefined
      ? 'Claude 4.5+ models only accept Temperature OR Top P. Clear Temperature to use Top P.'
      : 'Claude 4.5+ models only accept Temperature OR Top P. Setting Temperature will clear Top P.';

  return (
    <>
      <Popover
        open={popoverOpen}
        onOpenChange={(open, details) => {
          if (!open && advancedOpen) {
            details?.cancel?.();
            return;
          }
          setPopoverOpen(open);
        }}
      >
        <PopoverTrigger render={<ComposerModelSettingsButton />} />
        <PopoverContent align="start" className="w-80 p-4">
          {isLoading || isMemoryLoading ? (
            <Skeleton className="h-40 w-full" data-testid="composer-model-settings-skeleton" />
          ) : (
            <section className="@container space-y-5">
              <Entry label="Chat Method">
                <RadioGroup
                  value={radioValue}
                  disabled={!canEditSettings}
                  onValueChange={value => {
                    if (!canEditSettings) return;
                    setSettings({
                      ...settings,
                      modelSettings: {
                        ...settings?.modelSettings,
                        chatWithGenerateLegacy: value === 'generateLegacy',
                        chatWithGenerate: value === 'generate',
                        chatWithLegacyStream: value === 'stream',
                        chatWithNetwork: value === 'network',
                      },
                    });
                  }}
                  className="flex flex-col gap-3"
                >
                  {methods.map(option => (
                    <MethodRadio
                      key={option.value}
                      option={option}
                      disabled={!canEditSettings}
                      id={`${methodId}-${option.value}`}
                    />
                  ))}
                </RadioGroup>
              </Entry>
              <Entry label="Require Tool Approval">
                <Checkbox
                  aria-label="Require Tool Approval"
                  checked={settings?.modelSettings?.requireToolApproval ?? false}
                  disabled={!canEditSettings}
                  onCheckedChange={requireToolApproval => {
                    if (canEditSettings)
                      setSettings({ ...settings, modelSettings: { ...settings?.modelSettings, requireToolApproval } });
                  }}
                />
              </Entry>
              {showSamplingBanner && (
                <div
                  className="bg-surface3 text-ui-sm text-neutral3 flex items-center gap-2 rounded px-3 py-2"
                  data-testid="sampling-restriction-banner"
                >
                  <Info className="size-3.5 shrink-0" />
                  <span>{samplingNotice}</span>
                </div>
              )}
              <Entry label="Temperature">
                <div className="flex flex-row items-center justify-between gap-2">
                  <Slider
                    aria-label="Temperature"
                    value={[settings?.modelSettings?.temperature ?? -0.1]}
                    max={1}
                    min={-0.1}
                    step={0.1}
                    disabled={!canEditSettings}
                    onValueChange={values => {
                      const temperature = values[0];
                      if (canEditSettings && temperature !== undefined)
                        setSettings({
                          ...settings,
                          modelSettings: {
                            ...settings?.modelSettings,
                            temperature: temperature < 0 ? undefined : temperature,
                          },
                        });
                    }}
                  />
                  <Txt as="p" variant="ui-sm" className="text-neutral3">
                    {settings?.modelSettings?.temperature ?? 'n/a'}
                  </Txt>
                </div>
              </Entry>
              <Entry label="Top P">
                <div className="flex flex-row items-center justify-between gap-2">
                  <Slider
                    aria-label="Top P"
                    value={[settings?.modelSettings?.topP ?? -0.1]}
                    max={1}
                    min={-0.1}
                    step={0.1}
                    disabled={!canEditSettings}
                    onValueChange={values => {
                      const topP = values[0];
                      if (canEditSettings && topP !== undefined)
                        setSettings({
                          ...settings,
                          modelSettings: { ...settings?.modelSettings, topP: topP < 0 ? undefined : topP },
                        });
                    }}
                  />
                  <Txt as="p" variant="ui-sm" className="text-neutral3">
                    {settings?.modelSettings?.topP ?? 'n/a'}
                  </Txt>
                </div>
              </Entry>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  icon={<RotateCcw />}
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={!canEditSettings}
                  onClick={() => {
                    if (canEditSettings) resetAll();
                  }}
                >
                  Reset
                </Button>
                <Button
                  icon={<Settings2 />}
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
            <AgentAdvancedSettingsBody
              canEdit={canEditSettings}
              value={settings?.modelSettings ?? {}}
              onChange={value => setSettings({ ...settings, modelSettings: { ...settings?.modelSettings, ...value } })}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface ModelSettingsMethod {
  value: string;
  label: string;
  unavailable?: string;
}
function MethodRadio({ option, disabled, id }: { option: ModelSettingsMethod; disabled: boolean; id: string }) {
  const descriptionId = option.unavailable ? `${id}-unavailable` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <RadioGroupItem
          value={option.value}
          id={id}
          aria-describedby={descriptionId}
          className="text-neutral6"
          disabled={disabled || Boolean(option.unavailable)}
        />
        <Label
          className={cn('text-ui-md text-neutral6', option.unavailable && 'cursor-not-allowed text-neutral3!')}
          htmlFor={id}
        >
          {option.label}
        </Label>
      </div>
      {option.unavailable && (
        <p id={descriptionId} className="text-ui-sm text-neutral3 ml-6">
          {option.unavailable}
        </p>
      )}
    </div>
  );
}
