import { ScrollArea } from '@/components/ui/scroll-area';

import { Slider } from '@/components/ui/slider';

import { AgentContext, Button, Icon, Txt } from '@mastra/playground-ui';
import { useContext } from 'react';
import { Label } from '@/components/ui/label';

import { RefreshCw } from 'lucide-react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Entry } from '@/components/ui/entry';

import { GetAgentResponse } from '@mastra/client-js';
import { AgentAdvancedSettings } from './agent-advanced-settings';

export interface AgentDetailsProps {
  agent: GetAgentResponse;
}

export function AgentDetails({ agent }: AgentDetailsProps) {
  const { modelSettings, setModelSettings, chatWithGenerate, setChatWithGenerate } = useContext(AgentContext);

  const workflowsArray = Object.entries(agent?.workflows ?? {});

  return (
    <ScrollArea className="h-[calc(100vh-126px)] px-5 pb-4 text-xs py-2">
      <div>
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
                  value={[modelSettings?.temperature ?? 0.5]}
                  max={1}
                  step={0.1}
                  onValueChange={value => setModelSettings({ ...modelSettings, temperature: value[0] })}
                />
                <Txt as="p" variant="ui-sm" className="text-icon3">
                  {modelSettings?.temperature}
                </Txt>
              </div>
            </Entry>

            <Entry label="Top P">
              <div className="flex flex-row justify-between items-center gap-2">
                <Slider
                  onValueChange={value => setModelSettings({ ...modelSettings, topP: value[0] })}
                  value={[modelSettings?.topP ?? 1]}
                  max={1}
                  step={0.1}
                />

                <Txt as="p" variant="ui-sm" className="text-icon3">
                  {modelSettings?.topP}
                </Txt>
              </div>
            </Entry>
          </div>
        </section>

        <section className="py-7">
          <AgentAdvancedSettings />
        </section>

        <Button
          onClick={() =>
            setModelSettings({
              frequencyPenalty: undefined,
              presencePenalty: undefined,
              maxRetries: 2,
              maxSteps: 5,
              maxTokens: undefined,
              temperature: 0.5,
              topP: 1,
              topK: undefined,
            })
          }
        >
          <Icon>
            <RefreshCw />
          </Icon>
          Reset
        </Button>

        {workflowsArray?.length ? (
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <p className="text-mastra-el-3">Workflows</p>
            <div className="flex flex-col gap-2 text-mastra-el-5">
              {workflowsArray.map(([workflowKey, workflow]) => (
                <span
                  key={workflowKey}
                  onClick={() => {
                    // navigate(`/workflows/v-next/${workflowKey}/graph`);
                  }}
                  className="no-underline"
                >
                  {workflow.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}
