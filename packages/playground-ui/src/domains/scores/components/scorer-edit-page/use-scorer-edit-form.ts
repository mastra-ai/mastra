import { useForm, Resolver } from 'react-hook-form';

import type { ScorerFormValues } from './utils/form-validation';

const scorerFormResolver: Resolver<ScorerFormValues> = async values => {
  const errors: Record<string, { type: string; message: string }> = {};

  if (!values.name || values.name.trim() === '') {
    errors.name = { type: 'required', message: 'Name is required' };
  } else if (values.name.length > 100) {
    errors.name = { type: 'maxLength', message: 'Name must be 100 characters or less' };
  }

  if (values.description && values.description.length > 500) {
    errors.description = { type: 'maxLength', message: 'Description must be 500 characters or less' };
  }

  if (!values.model?.provider || values.model.provider.trim() === '') {
    errors['model.provider'] = { type: 'required', message: 'Provider is required' };
  }

  if (!values.model?.name || values.model.name.trim() === '') {
    errors['model.name'] = { type: 'required', message: 'Model is required' };
  }

  if (!values.instructions || values.instructions.trim() === '') {
    errors.instructions = { type: 'required', message: 'Instructions are required' };
  }

  return {
    values: Object.keys(errors).length === 0 ? values : {},
    errors: Object.keys(errors).length > 0 ? errors : {},
  };
};

export interface UseScorerEditFormOptions {
  initialValues?: Partial<ScorerFormValues>;
}

export function useScorerEditForm(options: UseScorerEditFormOptions = {}) {
  const { initialValues } = options;

  const form = useForm<ScorerFormValues>({
    resolver: scorerFormResolver,
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      type: initialValues?.type ?? 'llm-judge',
      model: initialValues?.model ?? { provider: '', name: '' },
      instructions: initialValues?.instructions ?? '',
      scoreRange: initialValues?.scoreRange ?? { min: 0, max: 1 },
      defaultSampling: initialValues?.defaultSampling,
    },
  });

  return { form };
}
