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

export const AgentSettings = ({ modelVersion }: { modelVersion: string }) => {
  const { settings, setSettings, resetAll } = useAgentSettings();

  let radioValue;

  if (modelVersion === 'v2') {
    radioValue = settings?.modelSettings?.chatWithGenerateVNext ? 'generateVNext' : 'streamVNext';
  } else {
    radioValue = settings?.modelSettings?.chatWithGenerate ? 'generate' : 'stream';
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
                  chatWithGenerate: value === 'generate',
                  chatWithGenerateVNext: value === 'generateVNext',
                  chatWithStreamVNext: value === 'streamVNext',
                },
              })
            }
            className="flex flex-row gap-4"
          >
            {modelVersion !== 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="generate" id="generate" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="generate">
                  Generate
                </Label>
              </div>
            )}
            {modelVersion === 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="generateVNext" id="generateVNext" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="generateVNext">
                  Generate vNext
                </Label>
              </div>
            )}
            {modelVersion !== 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="stream" id="stream" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="stream">
                  Stream
                </Label>
              </div>
            )}
            {modelVersion === 'v2' && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="streamVNext" id="streamVNext" className="text-icon6" />
                <Label className="text-icon6 text-ui-md" htmlFor="streamVNext">
                  Stream vNext
                </Label>
              </div>
            )}
          </RadioGroup>
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
