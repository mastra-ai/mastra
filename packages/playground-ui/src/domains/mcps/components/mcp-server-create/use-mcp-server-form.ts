import { useForm } from 'react-hook-form';

export interface MCPServerFormValues {
  name: string;
  version: string;
}

export const useMCPServerForm = (defaultValues?: Partial<MCPServerFormValues>) => {
  const form = useForm<MCPServerFormValues>({
    defaultValues: {
      name: '',
      version: '1.0.0',
      ...defaultValues,
    },
    resolver: async values => {
      const errors: Record<string, { type: string; message: string }> = {};

      if (!values.name.trim()) {
        errors.name = { type: 'required', message: 'Name is required' };
      }

      if (!values.version.trim()) {
        errors.version = { type: 'required', message: 'Version is required' };
      }

      return {
        values: Object.keys(errors).length === 0 ? values : {},
        errors,
      };
    },
  });

  return { form };
};
