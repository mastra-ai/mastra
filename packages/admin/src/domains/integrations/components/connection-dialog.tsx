'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  referenceId: z.string().min(1, {
    message: 'referenceId is required.',
  }),
});

interface ConnectionDialogProps {
  setReferenceId: (referenceId: string) => void;
  handleConnect: (referenceId: string) => void;
}

export function ConnectionDialog({ setReferenceId, handleConnect }: ConnectionDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      referenceId: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // TODO: check if connectionId is available
    setReferenceId(values.referenceId);
    handleConnect(values.referenceId);
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-3">
        <FormField
          control={form.control}
          name="referenceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ConnectionId</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>This could be your userId or a unique identifier.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Add</Button>
      </form>
    </Form>
  );
}
