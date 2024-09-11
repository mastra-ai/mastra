'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { toast } from '@/lib/toast';

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
  credential: Object; // CredentialInfo; (probably type)
}

export const IntegrationSetupForm = ({ integrationName, credential }: IntegrationSetupFormProps) => {
  const defaultValues = credential;
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
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

  const onSubmit = async (credential: CredentialInfo) => {
    try {
      setIsLoading(true);
      await addIntegrationAction({ integrationName, credential });
      toast('Integration Added');

      router.push(`/setup/${integrationName}/connect`.toLowerCase());
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
          return (
            <FormField
              key={fieldId}
              control={form.control}
              name={fieldId as keyof FieldId}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-kp-el-3 text-xs font-medium">{fieldToLabelMap[fieldId]}</FormLabel>
                  <FormControl>
                    <Input
                      type={isSecret ? 'password' : 'text'}
                      className=" placeholder:text-sm bg-white/5 overflow-ellipsis"
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
          <Button disabled={isLoading} type="submit" className="h-8 px-4 w-full rounded">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};
