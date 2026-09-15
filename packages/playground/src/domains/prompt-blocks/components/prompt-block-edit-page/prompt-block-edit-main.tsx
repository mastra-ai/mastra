import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import type { RuleGroup } from '@mastra/playground-ui/utils/rule-engine';
import type { UseFormReturn } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';

import type { PromptBlockFormValues } from './utils/form-validation';
import { DisplayConditionsDialog, SectionHeader } from '@/domains/cms';

interface PromptBlockEditMainProps {
  form: UseFormReturn<PromptBlockFormValues>;
  /** Key that changes when form is reset with new data, forces CodeEditor to remount */
  formResetKey?: number;
}

export function PromptBlockEditMain({ form, formResetKey = 0 }: PromptBlockEditMainProps) {
  const { control, setValue } = form;

  const schema = useWatch({ control, name: 'variables' }) as JsonSchema | undefined;
  const rules = useWatch({ control, name: 'rules' }) as RuleGroup | undefined;

  const handleRulesChange = (ruleGroup: RuleGroup | undefined) => {
    setValue('rules', ruleGroup, { shouldDirty: true });
  };

  return (
    <div className="flex h-full flex-col gap-3 px-4">
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
          <div className="flex flex-1 flex-col">
            <CodeEditor
              key={formResetKey}
              value={field.value ?? ''}
              onChange={field.onChange}
              language="markdown"
              showCopyButton
              placeholder="Enter prompt block content..."
              highlightVariables
              schema={schema}
              className="min-h-[200px] flex-1"
            />
          </div>
        )}
      />
    </div>
  );
}
