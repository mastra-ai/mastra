import { Controller } from 'react-hook-form';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { SectionHeader } from '@/domains/cms';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentCMSBlocks } from '../agent-cms-blocks';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';

export function InstructionBlocksPage() {
  const { form } = useAgentEditFormContext();

  const schema = form.watch('variables');

  return (
    <ScrollArea className="h-full">
      <section className="flex flex-col gap-6">
        <SectionHeader
          title="Instruction blocks"
          subtitle="Add instruction blocks to your agent. Blocks are combined in order to form the system prompt."
        />

        <Alert variant="info">
          <AlertTitle>Using variables</AlertTitle>

          <AlertDescription as="p">
            Blocks are combined in order to form the system prompt. Use{' '}
            <code className="text-accent1 font-medium">{'{{variableName}}'}</code> to insert dynamic values.
          </AlertDescription>
        </Alert>

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
