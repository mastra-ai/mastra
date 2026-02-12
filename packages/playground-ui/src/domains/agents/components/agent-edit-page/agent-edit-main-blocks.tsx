import { UseFormReturn, Controller } from 'react-hook-form';
import { Blocks } from 'lucide-react';

import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from './utils/form-validation';
import { AgentCMSBlocks } from '../agent-cms-blocks';

interface AgentEditMainProps {
  form: UseFormReturn<AgentFormValues>;
  readOnly?: boolean;
}

export function AgentEditMainContentBlocks({ form, readOnly: _readOnly = false }: AgentEditMainProps) {
  const schema = form.watch('variables');

  return (
    <div className="grid grid-rows-[auto_1fr] gap-6 h-full px-4 pb-4">
      <SectionHeader title="Instruction blocks" subtitle="Add instruction blocks to your agent." icon={<Blocks />} />

      <div className="h-full overflow-y-auto">
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
    </div>
  );
}
