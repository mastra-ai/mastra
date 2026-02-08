import { UseFormReturn, Controller } from 'react-hook-form';
import { Blocks, Play } from 'lucide-react';
import { useState } from 'react';

import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from './utils/form-validation';
import { AgentCMSBlocks } from '../agent-cms-blocks';
import { Button } from '@/ds/components/Button';
import { InstructionsPreviewDialog } from './instructions-preview-dialog';

interface AgentEditMainProps {
  form: UseFormReturn<AgentFormValues>;
  readOnly?: boolean;
}

export function AgentEditMainContentBlocks({ form, readOnly: _readOnly = false }: AgentEditMainProps) {
  const schema = form.watch('variables');
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const blocks = form.watch('instructionBlocks') ?? [];

  return (
    <div className="grid grid-rows-[auto_1fr] gap-6 h-full px-4 pb-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Instruction blocks" subtitle="Add instruction blocks to your agent." icon={<Blocks />} />

        <Button type="button" variant="outline" size="sm" onClick={() => setIsPreviewDialogOpen(true)}>
          <Play className="h-4 w-4" />
          Visualize compiled instructions
        </Button>
      </div>

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

        <InstructionsPreviewDialog
          open={isPreviewDialogOpen}
          onOpenChange={setIsPreviewDialogOpen}
          blocks={blocks}
          variablesSchema={schema}
        />
      </div>
    </div>
  );
}
