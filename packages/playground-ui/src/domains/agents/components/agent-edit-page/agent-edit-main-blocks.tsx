import { UseFormReturn } from 'react-hook-form';
import { Blocks, Eye } from 'lucide-react';
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
  const [items, setItems] = useState<Array<string>>([]);
  const schema = form.watch('variables');
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 h-full p-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Blocks" subtitle="Add instruction blocks to your agent." icon={<Blocks />} />

        <Button type="button" variant="outline" size="sm" onClick={() => setIsPreviewDialogOpen(true)}>
          <Eye className="h-4 w-4" />
          Visualize instructions
        </Button>
      </div>

      <AgentCMSBlocks items={items} onChange={setItems} placeholder="Enter content..." schema={schema} />

      <InstructionsPreviewDialog
        open={isPreviewDialogOpen}
        onOpenChange={setIsPreviewDialogOpen}
        instructions={items.join('\n')}
        variablesSchema={schema}
      />
    </div>
  );
}
