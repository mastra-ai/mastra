import { Controller, useWatch, UseFormReturn } from 'react-hook-form';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { DisplayConditionsDialog, SectionHeader } from '@/domains/cms';
import type { JsonSchema, RuleGroup } from '@/lib/rule-engine';

import type { PromptBlockFormValues } from './utils/form-validation';

interface PromptBlockEditMainProps {
  form: UseFormReturn<PromptBlockFormValues>;
}

export function PromptBlockEditMain({ form }: PromptBlockEditMainProps) {
  const { control, setValue } = form;

  const schema = useWatch({ control, name: 'variables' }) as JsonSchema | undefined;
  const rules = useWatch({ control, name: 'rules' }) as RuleGroup | undefined;

  const handleRulesChange = (ruleGroup: RuleGroup | undefined) => {
    setValue('rules', ruleGroup, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-3 h-full px-4">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Content"
          subtitle="Write the prompt block content. Use {{variableName}} for template variables."
        />
        <DisplayConditionsDialog
          entityName="Prompt Block"
          schema={schema}
          rules={rules}
          onRulesChange={handleRulesChange}
        />
      </div>
      <Controller
        name="content"
        control={control}
        render={({ field }) => (
          <div className="flex-1 flex flex-col">
            <CodeEditor
              value={field.value ?? ''}
              onChange={field.onChange}
              language="markdown"
              showCopyButton={false}
              placeholder="Enter prompt block content..."
              wordWrap
              highlightVariables
              schema={schema}
              className="flex-1 min-h-[200px]"
            />
          </div>
        )}
      />
    </div>
  );
}
