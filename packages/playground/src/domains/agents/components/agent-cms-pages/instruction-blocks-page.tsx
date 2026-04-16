import { ScrollArea } from '@mastra/playground-ui';
import { Controller } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentCMSBlocks } from '../agent-cms-blocks';

export function InstructionBlocksPage() {
  const { form } = useAgentEditFormContext();

  const schema = form.watch('variables');

  return (
    <ScrollArea className="h-full">
      <div className="py-6 px-2">
        <Controller
          name="instructionBlocks"
          control={form.control}
          defaultValue={[]}
          render={({ field }) => (
            <AgentCMSBlocks
              items={field.value ?? []}
              onChange={field.onChange}
              placeholder="Enter content..."
              schema={schema}
            />
          )}
        />
      </div>
    </ScrollArea>
  );
}
