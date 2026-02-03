import { Controller, UseFormReturn } from 'react-hook-form';
import { FileText } from 'lucide-react';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from './utils/form-validation';

interface AgentEditMainProps {
  form: UseFormReturn<AgentFormValues>;
  readOnly?: boolean;
}

export function AgentEditMain({ form, readOnly = false }: AgentEditMainProps) {
  const {
    control,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-6 h-full pb-4">
      {/* Instructions - CodeEditor */}
      <div className="flex flex-col gap-3 flex-1 min-h-0 px-4 pt-4">
        <SectionHeader
          title="Instructions"
          subtitle="Write your agent's system prompt."
          icon={
            <Icon>
              <FileText className="text-accent5" />
            </Icon>
          }
        />
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <div className={readOnly ? 'pointer-events-none' : ''}>
              <CodeEditor
                value={field.value}
                onChange={readOnly ? undefined : field.onChange}
                language="markdown"
                showCopyButton={false}
                placeholder="Enter agent instructions..."
                wordWrap
                className={cn('flex-1 min-h-[200px]', errors.instructions && 'border border-accent2')}
              />
            </div>
          )}
        />
        {errors.instructions && <span className="text-xs text-accent2">{errors.instructions.message}</span>}
      </div>
    </div>
  );
}
