import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { FileText, GaugeIcon } from 'lucide-react';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { Icon } from '@/ds/icons';
import { SectionHeader } from '@/domains/cms';

import type { ScorerFormValues } from './utils/form-validation';
import { EmptyState } from '@/ds/components/EmptyState';

interface ScorerEditMainProps {
  form: UseFormReturn<ScorerFormValues>;
}

export function ScorerEditMain({ form }: ScorerEditMainProps) {
  const { control } = form;
  const watchedType = useWatch({ control, name: 'type' });
  const isLlmJudge = watchedType === 'llm-judge';

  if (!isLlmJudge) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<GaugeIcon className="text-neutral3 size-16" />}
          titleSlot="This is a preset scorer."
          descriptionSlot="Preset scorers use built-in evaluation logic and don't require custom instructions."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full px-4">
      <SectionHeader
        title="Instructions"
        subtitle="Write your scorer's system prompt."
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
