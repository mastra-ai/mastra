import { Slider } from '@/components/ui/slider';

import { Label } from '@/components/ui/label';

import { Check, RefreshCw } from 'lucide-react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { Entry } from '@/components/ui/entry';
import { useAgentSettings } from '../context/agent-context';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt/Txt';
import { ModelSettings } from '@/types';
import { AgentAdvancedSettings } from './agent-advanced-settings';
import Spinner from '@/components/ui/spinner';
import { InfoIcon } from '@/ds/icons';

export interface AgentModelSettingsProps {
  isSaving?: boolean;
  onSave?: ({
    generationType,
    modelSettings,
  }: {
    generationType: 'stream' | 'generation';
    modelSettings: ModelSettings;
  }) => Promise<void>;
}

export function AgentModelSettings({ onSave, isSaving }: AgentModelSettingsProps) {
  const {
    modelSettings,
    setModelSettings,
    chatWithGenerate,
    setChatWithGenerate,
    resetModelSettings,
    isFormDirty,
    onResetFormDirty,
  } = useAgentSettings();

  const handleSave = async () => {
    if (onSave) {
      await onSave({ generationType: chatWithGenerate ? 'generation' : 'stream', modelSettings });
      onResetFormDirty();
    }
  };

  return (
    <div className="px-5 text-xs py-2 pb-4">
      {isFormDirty && Boolean(onSave) && (
        <div className="p-2 bg-surface4 rounded-lg mb-4 flex gap-2">
          <Icon className="mt-1">
            <InfoIcon />
          </Icon>
          <div>
            <Txt as="p" variant="ui-md" className="text-icon3">
              You have unsaved changes
            </Txt>
            <Txt as="p" variant="ui-sm" className="text-icon6">
              These settings are for testing only. Once you finish testing, remember to save the settings to make them
              permanent.
            </Txt>
          </div>
        </div>
      )}

      <section className="space-y-7">
        <Entry label="Chat Method">
          <RadioGroup
            orientation="horizontal"
            value={chatWithGenerate ? 'generate' : 'stream'}
            onValueChange={value => setChatWithGenerate(value === 'generate')}
            className="flex flex-row gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="generate" id="generate" className="text-icon6" />
              <Label className="text-icon6 text-ui-md" htmlFor="generate">
                Generate
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="stream" id="stream" className="text-icon6" />
              <Label className="text-icon6 text-ui-md" htmlFor="stream">
                Stream
              </Label>
            </div>
          </RadioGroup>
        </Entry>

        <div className="grid grid-cols-2 gap-8">
          <Entry label="Temperature">
            <div className="flex flex-row justify-between items-center gap-2">
              <Slider
                value={[modelSettings?.temperature ?? -0.1]}
                max={1}
                min={-0.1}
                step={0.1}
                onValueChange={value =>
                  setModelSettings({ ...modelSettings, temperature: value[0] < 0 ? undefined : value[0] })
                }
              />
              <Txt as="p" variant="ui-sm" className="text-icon3">
                {modelSettings?.temperature ?? 'n/a'}
              </Txt>
            </div>
          </Entry>

          <Entry label="Top P">
            <div className="flex flex-row justify-between items-center gap-2">
              <Slider
                onValueChange={value =>
                  setModelSettings({ ...modelSettings, topP: value[0] < 0 ? undefined : value[0] })
                }
                value={[modelSettings?.topP ?? -0.1]}
                max={1}
                min={-0.1}
                step={0.1}
              />

              <Txt as="p" variant="ui-sm" className="text-icon3">
                {modelSettings?.topP ?? 'n/a'}
              </Txt>
            </div>
          </Entry>
        </div>
      </section>

      <section className="py-7">
        <AgentAdvancedSettings />
      </section>

      <div className="flex flex-col gap-2">
        {onSave && (
          <Button onClick={handleSave} variant="light" className="w-full" size="lg" disabled={isSaving}>
            <Icon>{isSaving ? <Spinner /> : <Check />}</Icon>
            Save
          </Button>
        )}
        <Button onClick={() => resetModelSettings()} variant="light" className="w-full" size="lg">
          <Icon>
            <RefreshCw />
          </Icon>
          Reset
        </Button>
      </div>
    </div>
  );
}
