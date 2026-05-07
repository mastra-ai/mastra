import { useForm } from 'react-hook-form';

export interface MCPClientFormValues {
  name: string;
  description: string;
  serverName: string;
  serverType: 'stdio' | 'http';
  url: string;
  timeout: number;
  command: string;
  args: string;
  env: { key: string; value: string }[];
}

export const useMCPClientForm = (defaultValues?: Partial<MCPClientFormValues>) => {
  const form = useForm<MCPClientFormValues>({
    defaultValues: {
      name: '',
      description: '',
      serverName: 'default',
      serverType: 'http',
      url: '',
      timeout: 30000,
      command: '',
      args: '',
      env: [],
      ...defaultValues,
    },
    resolver: async values => {
      const errors: Record<string, { type: string; message: string }> = {};

      if (!values.name.trim()) {
        errors.name = { type: 'required', message: 'Name is required' };
      }

      if (!values.serverName.trim()) {
        errors.serverName = { type: 'required', message: 'Server name is required' };
      }

      if (values.serverType === 'http' && !values.url.trim()) {
        errors.url = { type: 'required', message: 'URL is required for HTTP servers' };
      }

      if (values.serverType === 'stdio' && !values.command.trim()) {
        errors.command = { type: 'required', message: 'Command is required for stdio servers' };
      }

      return {
        values: Object.keys(errors).length === 0 ? values : {},
        errors,
      };
    },
  });

  return { form };
};
