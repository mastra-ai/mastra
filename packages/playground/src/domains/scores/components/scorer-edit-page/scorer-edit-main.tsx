import { CodeEditor } from '@mastra/playground-ui';
import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import type { ScorerFormValues } from './utils/form-validation';
import { SectionHeader } from '@/domains/cms';

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
              className="flex-1 min-h-[200px]"
            />
          </div>
        )}
      />
    </div>
  );
}
