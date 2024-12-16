'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  connectionId: z.string().min(1, {
    message: 'connectionId is required.',
  }),
});

interface ReferenceDialogProps {
  setConnectionId: (connectionId: string) => void;
  handleConnect: (connectionId: string) => void;
}

export function ReferenceDialog({ setConnectionId, handleConnect }: ReferenceDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      connectionId: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // TODO: check if connectionId is available
    setConnectionId(values.connectionId);
    handleConnect(values.connectionId);
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-3">
        <FormField
          control={form.control}
          name="connectionId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Connection Id</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>This could be your userId or a unique identifier.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          Add
        </Button>
      </form>
    </Form>
  );
}
