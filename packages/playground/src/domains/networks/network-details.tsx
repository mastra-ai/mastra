import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';
import { Agent } from '@/components/ui/agent-logo';
import { GetVNextNetworkResponse } from '@mastra/client-js';
import { useContext } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { ScrollArea } from '@/components/ui/scroll-area';

import { RadioGroup, RadioGroupItem, Entry, NetworkContext, ToolsIcon, WorkflowIcon } from '@mastra/playground-ui';

type NetworkDetailsProps = {
  network: GetVNextNetworkResponse;
};

export function NetworkDetails({ network }: NetworkDetailsProps) {
  const { chatWithLoop, setChatWithLoop, maxIterations, setMaxIterations } = useContext(NetworkContext);

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

        <div>
          <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Routing Model</h3>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-mastra-el-4" />
            <Badge className="border-none text-xs">{network.routingModel?.modelId || 'Unknown'}</Badge>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Routing Model Settings</h3>

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
        </div>
      </div>
    </ScrollArea>
  );
}
