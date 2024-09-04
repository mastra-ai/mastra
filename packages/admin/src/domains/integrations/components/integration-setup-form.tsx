'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z, ZodSchema } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { addIntegrationAction } from '@/app/(dashboard)/integrations/actions';

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
  authType: 'oauth' | 'api-key';
  credential: Object; // CredentialInfo; (probably type)
}

export const IntegrationSetupForm = ({ integrationName, authType, credential }: IntegrationSetupFormProps) => {
  const defaultValues = credential;
  const formSchema = z.object({
    clientID: z.string().min(1, 'Required'),
    clientSecret: z.string().min(1, 'Required'),
  });
  type FieldId = z.infer<typeof formSchema>;
  const fieldToLabelMap: Record<string, string> = {
    clientID: 'CLIENT_ID',
    clientSecret: 'CLIENT_SECRET',
  };
  const fields = Object.keys(getZodSchemaFieldsShallow(formSchema));
  const form = useForm<FieldId>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const isOauth = authType === 'oauth';

  const onSubmit = async (credential: CredentialInfo) => {
    try {
      await addIntegrationAction({ integrationName, credential });
      toast.success('Integration Added', {
        position: 'bottom-center',
      });

      // TODO: isOauth influences where I redirect to
    } catch (err) {
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
          return (
            <FormField
              key={fieldId}
              control={form.control}
              name={fieldId as keyof FieldId}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-arkw-el-3 text-xs font-medium">{fieldToLabelMap[fieldId]}</FormLabel>
                  <FormControl>
                    <Input
                      type={isSecret ? 'password' : 'text'}
                      className=" placeholder:text-sm bg-white/5"
                      placeholder="***"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}

        <div className="flex space-x-3 text-sm items-center">
          <Button type="submit" className="h-8 px-4 rounded">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};
