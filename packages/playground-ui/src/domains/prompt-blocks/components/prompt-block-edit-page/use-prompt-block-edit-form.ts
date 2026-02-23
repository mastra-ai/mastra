import { useForm, Resolver } from 'react-hook-form';

import type { PromptBlockFormValues } from './utils/form-validation';

const promptBlockFormResolver: Resolver<PromptBlockFormValues> = async values => {
  const errors: Record<string, { type: string; message: string }> = {};

  if (!values.name || values.name.trim() === '') {
    errors.name = { type: 'required', message: 'Name is required' };
  } else if (values.name.length > 100) {
    errors.name = { type: 'maxLength', message: 'Name must be 100 characters or less' };
  }

  if (values.description && values.description.length > 500) {
    errors.description = { type: 'maxLength', message: 'Description must be 500 characters or less' };
  }

  if (!values.content || values.content.trim() === '') {
    errors.content = { type: 'required', message: 'Content is required' };
  }

  return {
    values: Object.keys(errors).length === 0 ? values : {},
    errors: Object.keys(errors).length > 0 ? errors : {},
  };
};

export interface UsePromptBlockEditFormOptions {
  initialValues?: Partial<PromptBlockFormValues>;
}

export function usePromptBlockEditForm(options: UsePromptBlockEditFormOptions = {}) {
  const { initialValues } = options;

  const form = useForm<PromptBlockFormValues>({
    resolver: promptBlockFormResolver,
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      content: initialValues?.content ?? '',
      rules: initialValues?.rules,
      variables: initialValues?.variables,
    },
  });

  return { form };
}
