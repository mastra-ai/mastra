import { useRunOptionsDraft } from '@mastra/playground-ui/domains/run-options';
import { useFormContext, useWatch } from 'react-hook-form';
import type { z } from 'zod';

interface RequestContextFormDraftProps {
  schema: z.ZodType<Record<string, unknown>>;
  defaultValues: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => void;
}

/** Registers the form with the shared Save button while retaining field validation. */
export function RequestContextFormDraft({ schema, defaultValues, onSave }: RequestContextFormDraftProps) {
  const form = useFormContext<Record<string, unknown>>();
  const values = useWatch({ control: form.control });

  useRunOptionsDraft({
    isDirty: form.formState.isDirty && JSON.stringify(values) !== JSON.stringify(defaultValues),
    save: () => {
      const result = schema.safeParse(form.getValues());
      form.clearErrors();
      if (!result.success) {
        result.error.issues.forEach((issue, index) => {
          form.setError(issue.path.join('.'), { type: 'custom', message: issue.message }, { shouldFocus: index === 0 });
        });
        return false;
      }
      onSave(result.data);
      form.reset(result.data);
      return true;
    },
  });

  return null;
}
