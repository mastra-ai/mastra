'use client';

import { useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Play, FileText } from 'lucide-react';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from '../agent-edit/form-validation';
import { TestInstructionDialog } from './test-instruction-dialog';

interface AgentEditMainProps {
  form: UseFormReturn<AgentFormValues>;
}

export function AgentEditMain({ form }: AgentEditMainProps) {
  const {
    control,
    formState: { errors },
    watch,
  } = form;

  // Watch instructions and partials for test dialog
  const instructions = watch('instructions');
  const partials = watch('partials') || {};

  // State for test dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 h-full pb-4">
      {/* Instructions - CodeEditor */}
      <div className="flex flex-col gap-3 flex-1 min-h-0 px-4 pt-4">
        <div className="flex items-start justify-between">
          <SectionHeader
            title="Instructions"
            subtitle="Write your agent's system prompt using Handlebars syntax for dynamic content."
            icon={
              <Icon>
                <FileText className="text-accent5" />
              </Icon>
            }
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setTestDialogOpen(true)}>
            <Icon>
              <Play />
            </Icon>
            See compiled prompt
          </Button>
        </div>
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <CodeEditor
              value={field.value}
              onChange={field.onChange}
              language="markdown"
              showCopyButton={false}
              placeholder="Enter agent instructions..."
              wordWrap
              className={cn('flex-1 min-h-[200px]', errors.instructions && 'border border-accent2')}
            />
          )}
        />
        {errors.instructions && <span className="text-xs text-accent2">{errors.instructions.message}</span>}
      </div>

      {/* Test Instructions Dialog */}
      <TestInstructionDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        instructions={instructions || ''}
        partials={partials}
      />
    </div>
  );
}
