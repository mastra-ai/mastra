import { useNavigate } from 'react-router';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';

import { useAgent } from '@/hooks/use-agents';
import { AgentContext } from '@mastra/playground-ui';
import { useContext } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AgentDetails({ agentId }: { agentId: string }) {
  const { isLoading, agent } = useAgent(agentId);
  const navigate = useNavigate();
  const { modelSettings, setModelSettings } = useContext(AgentContext);

  if (isLoading) {
    return (
      <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs">
        <div className="space-y-4">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3" />
              <Skeleton className="h-3" />
              <Skeleton className="h-3" />
            </div>
          </div>
        </div>
      </ScrollArea>
    );
  }

  const toolsArray = Object.entries(agent?.tools ?? {});

  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs">
      <div className="space-y-4">
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Name</p>
          <p className="text-mastra-el-5">{agent?.name}</p>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Model</p>
          <p className="text-mastra-el-5">{agent?.modelId}</p>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Provider</p>
          <p className="text-mastra-el-5">{agent?.provider?.split('.')[0].toUpperCase()}</p>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Model Settings</p>
          <div className="flex flex-col gap-3 text-mastra-el-5 pb-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row justify-between">
                <Label className="text-mastra-el-3 text-[12px]">Temperature</Label>
                <p className="text-mastra-el-5 text-[12px]">{modelSettings?.temperature}</p>
              </div>
              <Slider
                value={[modelSettings?.temperature ?? 0.5]}
                max={1}
                step={0.1}
                onValueChange={value => setModelSettings({ ...modelSettings, temperature: value[0] })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-row justify-between">
                <Label className="text-mastra-el-3 text-[12px]">Top P</Label>
                <p className="text-mastra-el-5 text-[12px]">{modelSettings?.topP}</p>
              </div>
              <Slider
                onValueChange={value => setModelSettings({ ...modelSettings, topP: value[0] })}
                value={[modelSettings?.topP ?? 1]}
                max={1}
                step={0.1}
              />
            </div>
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
                      setModelSettings({ ...modelSettings, topK: e.target.value ? Number(e.target.value) : undefined })
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
                className="h-max p-0 group w-max bg-transparent hover:bg-transparent flex flex-row items-center gap-2  text-[12px]"
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
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Tools</p>
          <div className="flex flex-col gap-2 text-mastra-el-5">
            {toolsArray?.length ? (
              toolsArray.map(([toolKey, tool]) => (
                <span
                  key={toolKey}
                  onClick={() => {
                    navigate(`/tools/${agentId}/${tool.id}`);
                  }}
                  className="no-underline"
                >
                  {tool.id}
                </span>
              ))
            ) : (
              <p className="text-mastra-el-5">No tools</p>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
