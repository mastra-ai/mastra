import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Controller } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentCMSBlocks } from '../agent-cms-blocks';

export function InstructionBlocksPage() {
  const { form, readOnly } = useAgentEditFormContext();

  const schema = form.watch('variables');

  return (
    <ScrollArea className="h-full">
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
            readOnly={readOnly}
          />
        )}
      />
    </ScrollArea>
  );
}
