import { Controller } from 'react-hook-form';
import { Blocks } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { SectionHeader } from '@/domains/cms';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentCMSBlocks } from '../agent-cms-blocks';

export function InstructionBlocksPage() {
  const { form } = useAgentEditFormContext();

  const schema = form.watch('variables');

  return (
    <ScrollArea className="h-full">
      <section className="flex flex-col gap-6">
        <SectionHeader title="Instruction blocks" subtitle="Add instruction blocks to your agent." icon={<Blocks />} />

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
      </section>
    </ScrollArea>
  );
}
