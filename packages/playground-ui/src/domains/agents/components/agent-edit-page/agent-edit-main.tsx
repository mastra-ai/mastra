import { useMemo, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { FileText } from 'lucide-react';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/domains/cms';

import { InstructionsPreviewDialog } from './instructions-preview-dialog';
import type { AgentFormValues, InstructionBlock } from './utils/form-validation';

interface AgentEditMainProps {
  form: UseFormReturn<AgentFormValues>;
  readOnly?: boolean;
}

export function AgentEditMain({ form, readOnly = false }: AgentEditMainProps) {
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const {
    control,
    formState: { errors },
    watch,
  } = form;

  const variables = watch('variables');
  const instructions = watch('instructions');

  // Convert single instruction string to a block array for the preview dialog
  const instructionBlocks = useMemo<InstructionBlock[]>(
    () => [{ id: 'single-instruction', content: instructions, rules: [] }],
    [instructions],
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Instructions - CodeEditor */}
      <div className="flex flex-col gap-3 flex-1 min-h-0 px-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Instructions"
            subtitle="Write your agent's system prompt."
            icon={
              <Icon>
                <FileText className="text-accent5" />
              </Icon>
            }
          />
          {/* <Button type="button" variant="outline" size="sm" onClick={() => setIsPreviewDialogOpen(true)}>
            <Eye className="h-4 w-4" />
            Visualize instructions
          </Button> */}
        </div>
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <div className={cn('flex-1 flex flex-col', readOnly && 'pointer-events-none')}>
              <CodeEditor
                value={field.value}
                onChange={readOnly ? undefined : field.onChange}
                language="markdown"
                showCopyButton={false}
                placeholder="Enter agent instructions..."
                wordWrap
                schema={variables}
                highlightVariables
                className={cn('flex-1 min-h-[200px]', errors.instructions && 'border border-accent2')}
              />
            </div>
          )}
        />
        {errors.instructions && <span className="text-xs text-accent2">{errors.instructions.message}</span>}
      </div>

      <InstructionsPreviewDialog
        open={isPreviewDialogOpen}
        onOpenChange={setIsPreviewDialogOpen}
        blocks={instructionBlocks}
        variablesSchema={variables}
      />
    </div>
  );
}
