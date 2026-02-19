import { Controller, UseFormReturn } from 'react-hook-form';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { SectionHeader } from '@/domains/cms';

import type { ScorerFormValues } from './utils/form-validation';

interface ScorerEditMainProps {
  form: UseFormReturn<ScorerFormValues>;
}

export function ScorerEditMain({ form }: ScorerEditMainProps) {
  const { control } = form;

  return (
    <div className="flex flex-col gap-3 h-full px-4">
      <SectionHeader title="Instructions" subtitle="Write your scorer's system prompt." />
      <Controller
        name="instructions"
        control={control}
        render={({ field }) => (
          <div className="flex-1 flex flex-col">
            <CodeEditor
              value={field.value ?? ''}
              onChange={field.onChange}
              language="markdown"
              showCopyButton={false}
              placeholder="Enter scorer instructions..."
              wordWrap
              className="flex-1 min-h-[200px]"
            />
          </div>
        )}
      />
    </div>
  );
}
