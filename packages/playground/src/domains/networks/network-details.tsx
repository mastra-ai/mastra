import { Badge } from '@/components/ui/badge';
import { Brain, ChevronDown, RefreshCw } from 'lucide-react';
import { Agent } from '@/components/ui/agent-logo';
import { GetNetworkResponse, GetVNextNetworkResponse } from '@mastra/client-js';
import { useContext } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  RadioGroup,
  RadioGroupItem,
  Entry,
  NetworkContext,
  ToolsIcon,
  Txt,
  WorkflowIcon,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@mastra/playground-ui';

type NetworkDetailsProps = {
  network: GetNetworkResponse | GetVNextNetworkResponse;
  isVNext?: boolean;
};

export function NetworkDetails({ network, isVNext }: NetworkDetailsProps) {
  const { modelSettings, setModelSettings, chatWithLoop, setChatWithLoop, maxIterations, setMaxIterations } =
    useContext(NetworkContext);

  return (
    <ScrollArea className="pt-2 px-4 pb-4 text-xs">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Network Name</h3>
          <p className="text-sm text-mastra-el-4">{network.name}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Instructions</h3>
          <div className="max-h-36 overflow-auto rounded border border-mastra-el-2 bg-mastra-bg-2 p-2">
            <p className="text-sm text-mastra-el-4">{network.instructions || 'No instructions provided'}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Agents</h3>
          <div className="flex items-center gap-2">
            <Agent />
            <Badge variant="outline" className="text-xs">
              {network.agents?.length || 0} agent{network.agents?.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </div>

        {isVNext && (
          <>
            <div>
              <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Workflows</h3>
              <div className="flex items-center gap-2">
                <WorkflowIcon />
                <Badge variant="outline" className="text-xs">
                  {(network as GetVNextNetworkResponse).workflows?.length || 0} workflow
                  {(network as GetVNextNetworkResponse).workflows?.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Tools</h3>
              <div className="flex items-center gap-2">
                <ToolsIcon />
                <Badge variant="outline" className="text-xs">
                  {(network as GetVNextNetworkResponse).tools?.length || 0} tool
                  {(network as GetVNextNetworkResponse).tools?.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>
          </>
        )}

        <div>
          <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Routing Model</h3>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-mastra-el-4" />
            <Badge className="border-none text-xs">{network.routingModel?.modelId || 'Unknown'}</Badge>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Routing Model Settings</h3>
          {isVNext ? (
            <div className="flex flex-col gap-3 text-mastra-el-5 pb-4">
              <Entry label="Chat Method">
                <RadioGroup
                  orientation="horizontal"
                  value={chatWithLoop ? 'loop' : 'stream'}
                  onValueChange={value => setChatWithLoop(value === 'loop')}
                  className="flex flex-row gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="loop" id="loop" className="text-icon6" />
                    <Label className="text-icon6 text-ui-md" htmlFor="loop">
                      Loop
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

              {chatWithLoop && (
                <Entry label="Max Iterations">
                  <Input
                    type="number"
                    value={maxIterations}
                    onChange={e => setMaxIterations(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </Entry>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-mastra-el-5 pb-4">
              <Entry label="Temperature">
                <div className="flex flex-row justify-between items-center gap-2">
                  <Slider
                    value={[modelSettings?.temperature ?? 0.5]}
                    max={1}
                    step={0.1}
                    onValueChange={value => setModelSettings({ ...modelSettings, temperature: value[0] })}
                  />
                  <Txt as="p" variant="ui-sm" className="text-icon3">
                    {modelSettings?.temperature ?? 'n/a'}
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
                    {modelSettings?.topP ?? 'n/a'}
                  </Txt>
                </div>
              </Entry>
              <Collapsible>
                <CollapsibleTrigger className="w-full group flex flex-row justify-between items-center pt-1 py-2">
                  <span className="text-mastra-el-3 text-[12px] group-hover:text-mastra-el-5">Extended Settings</span>
                  <ChevronDown className="w-4 h-4 text-mastra-el-3 group-hover:text-mastra-el-5" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-2 pt-2">
                  <div className="flex flex-col gap-2">
                    <Label className="text-mastra-el-3 text-[12px]">Top K</Label>
                    <Input
                      type="number"
                      value={modelSettings?.topK}
                      onChange={e =>
                        setModelSettings({
                          ...modelSettings,
                          topK: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-mastra-el-3 text-[12px]">Frequency Penalty</Label>
                    <Input
                      type="number"
                      value={modelSettings?.frequencyPenalty}
                      onChange={e =>
                        setModelSettings({
                          ...modelSettings,
                          frequencyPenalty: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-mastra-el-3 text-[12px]">Presence Penalty</Label>
                    <Input
                      type="number"
                      value={modelSettings?.presencePenalty}
                      onChange={e =>
                        setModelSettings({
                          ...modelSettings,
                          presencePenalty: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-mastra-el-3 text-[12px]">Max Tokens</Label>
                    <Input
                      type="number"
                      value={modelSettings?.maxTokens}
                      onChange={e =>
                        setModelSettings({
                          ...modelSettings,
                          maxTokens: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-mastra-el-3 text-[12px]">Max Steps</Label>
                    <Input
                      type="number"
                      value={modelSettings?.maxSteps}
                      onChange={e =>
                        setModelSettings({
                          ...modelSettings,
                          maxSteps: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-mastra-el-3 text-[12px]">Max Retries</Label>
                    <Input
                      type="number"
                      value={modelSettings?.maxRetries}
                      onChange={e =>
                        setModelSettings({
                          ...modelSettings,
                          maxRetries: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="flex flex-row justify-start gap-2">
                <Button
                  title="Reset"
                  variant="ghost"
                  className="h-max p-0 group w-max bg-transparent hover:bg-transparent flex flex-row items-center gap-2 text-[12px]"
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
                  <span className="text-mastra-el-3 text-[12px] group-hover:text-mastra-el-5">Reset</span>
                  <RefreshCw className="!w-3 !h-3 text-mastra-el-3 group-hover:text-mastra-el-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
