'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { useRouter } from 'next/navigation';

import MultiSelect from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { toast } from '@/lib/toast';

import { addIntegrationAction } from '@/domains/integrations/actions';

import { CredentialInfo } from '../types';

function getZodSchemaFieldsShallow(schema: ZodSchema) {
  const fields: Record<string, true> = {};
  const proxy = new Proxy(fields, {
    get(_, key) {
      if (key === 'then' || typeof key !== 'string') {
        return;
      }
      fields[key] = true;
    },
  });
  schema.safeParse(proxy);
  return fields;
}

interface IntegrationSetupFormProps {
  integrationName: string;
  credential: Object; // CredentialInfo; (probably type)
  availableScopes: { key: string; description: string }[];
  isUserDefined: boolean | undefined;
}

type SubmitProps = Omit<CredentialInfo, 'scopes'> & {
  scopes?: string[];
};

export const IntegrationOAuthSetupForm = ({
  integrationName,
  credential,
  availableScopes,
  isUserDefined,
}: IntegrationSetupFormProps) => {
  const defaultValues = credential;
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
  const formSchema = z.object({
    clientID: z.string().min(1, 'Required'),
    clientSecret: z.string().min(1, 'Required'),
    scopes: z.string().array().optional(),
  });
  type FieldId = z.infer<typeof formSchema>;
  const fieldToLabelMap: Record<string, string> = {
    clientID: 'CLIENT_ID',
    clientSecret: 'CLIENT_SECRET',
    scopes: 'SCOPES',
  };
  const fields = Object.keys(getZodSchemaFieldsShallow(formSchema));
  const form = useForm<FieldId>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const onSubmit = async (credential: SubmitProps) => {
    try {
      setIsLoading(true);
      await addIntegrationAction({
        integrationName,
        credential: {
          ...credential,
          scopes: credential?.scopes || [],
        },
        isUserDefined,
      });
      toast('Integration Added');

      router.push(`/setup/${integrationName.toLowerCase()}/connect`);
    } catch (err) {
      setIsLoading(false);
      toast.error('Could not add integration, try again', {
        position: 'bottom-center',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-[18px]">
        {fields.map(fieldId => {
          const isSecret = String(fieldId).toLowerCase().includes('secret') || fieldId.includes('key');
          const isScopesField = String(fieldId.toLowerCase()).includes('scopes');

          return (
            <FormField
              key={fieldId}
              control={form.control}
              name={fieldId as keyof FieldId}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-mastra-el-3 text-xs font-medium">{fieldToLabelMap[fieldId]}</FormLabel>
                  {isScopesField ? (
                    <div className="-mt-6">
                      <MultiSelect
                        fieldName="Scope"
                        options={availableScopes.map(scope => ({
                          label: `${scope.key} - ${scope.description}`,
                          value: scope.key,
                        }))}
                        onSelect={selected => {
                          form.setValue('scopes', selected.value);
                        }}
                      />
                    </div>
                  ) : (
                    <FormControl>
                      <Input
                        type={isSecret ? 'password' : 'text'}
                        className=" placeholder:text-xs bg-white/5 overflow-ellipsis"
                        placeholder={isScopesField ? '' : '***'}
                        {...field}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}

        <div className="flex space-x-3 text-sm items-center">
          <Button disabled={isLoading} type="submit" className="h-8 px-4 w-full rounded">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};
