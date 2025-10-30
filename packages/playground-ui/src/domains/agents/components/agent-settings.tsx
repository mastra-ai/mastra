import { Slider } from '@/components/ui/slider';

import { Label } from '@/components/ui/label';

import { RefreshCw } from 'lucide-react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { Entry } from '@/components/ui/entry';
import { useAgentSettings } from '../context/agent-context';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt/Txt';

import { AgentAdvancedSettings } from './agent-advanced-settings';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import clsx from 'clsx';
import { Checkbox } from '@/components/ui/checkbox';

export interface AgentSettingsProps {
  modelVersion: string;
  hasMemory?: boolean;
  hasSubAgents?: boolean;
}

const NetworkCheckbox = ({ hasMemory, hasSubAgents }: { hasMemory: boolean; hasSubAgents: boolean }) => {
  const isNetworkAvailable = hasMemory && hasSubAgents;

  const radio = (
    <div className="flex items-center gap-2">
      <RadioGroupItem value="network" id="network" className="text-icon6" disabled={!isNetworkAvailable} />
      <Label
        className={clsx('text-icon6 text-ui-md', !isNetworkAvailable && '!text-icon3 cursor-not-allowed')}
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

export const AgentSettings = ({ modelVersion, hasMemory = false, hasSubAgents = false }: AgentSettingsProps) => {
  const { settings, setSettings, resetAll } = useAgentSettings();

  let radioValue;

  if (modelVersion === 'v2') {
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
      <section className="space-y-7">
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
            className="flex flex-row gap-4"
          >
            {modelVersion !== 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="generateLegacy" id="generateLegacy" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="generateLegacy">
                  Generate (Legacy)
                </Label>
              </div>
            )}
            {modelVersion === 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="generate" id="generate" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="generate">
                  Generate
                </Label>
              </div>
            )}
            {modelVersion !== 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="streamLegacy" id="streamLegacy" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="streamLegacy">
                  Stream (Legacy)
                </Label>
              </div>
            )}
            {modelVersion === 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="stream" id="stream" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="stream">
                  Stream
                </Label>
              </div>
            )}
            {modelVersion === 'v2' && <NetworkCheckbox hasMemory={hasMemory} hasSubAgents={hasSubAgents} />}
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

        <div className="grid grid-cols-2 gap-8">
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
              <Txt as="p" variant="ui-sm" className="text-icon3">
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

              <Txt as="p" variant="ui-sm" className="text-icon3">
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
