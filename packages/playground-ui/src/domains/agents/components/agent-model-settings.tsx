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

export function AgentModelSettings() {
  const { modelSettings, setModelSettings, chatWithGenerate, setChatWithGenerate, resetModelSettings } =
    useAgentSettings();

  return (
    <div className="px-5 text-xs py-2 pb-4">
      <section className="space-y-7">
        <Entry label="Chat Method">
          <RadioGroup
            orientation="horizontal"
            value={chatWithGenerate ? 'generate' : 'stream'}
            onValueChange={(value: string) => setChatWithGenerate(value === 'generate')}
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

      <Button onClick={() => resetModelSettings()} variant="light" className="w-full" size="lg">
        <Icon>
          <RefreshCw />
        </Icon>
        Reset
      </Button>
    </div>
  );
}
