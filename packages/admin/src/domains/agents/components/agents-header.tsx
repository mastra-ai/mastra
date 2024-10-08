'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import SelectDropDown from '@/components/ui/select-dropdown';
import { Textarea } from '@/components/ui/textarea';

import { toast } from '@/lib/toast';

import { Header } from '@/app/components/header';
import Icon from '@/app/components/icon';

const formSchema = z.object({
  name: z.string().min(3, 'Agent name is required'),
});

export const AgentHeader = () => {
  const [syncedEntity, setSyncedEntity] = useState([] as Array<{ name: string; value: string }>);
  const [vectorStore, setVectorStore] = useState([] as Array<{ name: string }>);
  const form = useForm({
    defaultValues: {
      name: '',
      ragPrompt: '',
    },
    resolver: zodResolver(formSchema),
    reValidateMode: 'onSubmit',
  });

  function removeSyncedEntity(value: string) {
    setSyncedEntity(prev => prev.filter(item => item.value !== value));
  }

  const onSubmit = async (agentDetails: z.infer<typeof formSchema>) => {
    if (vectorStore.length < 1) {
      toast.error('Vector store is required. Fill it out in the mastra.config', {
        position: 'top-center',
      });
      return;
    }

    console.log({ agentDetails });
  };
  return (
    <div className="sticky top-0">
      <Header linkText="New agent" href="#" breadcrumbLabel="Agents" withDialog>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
            >
              <Icon name="plus-icon" className="text-current" />
              New agent
            </button>
          </DialogTrigger>
          <DialogContent className="">
            <DialogTitle className="sr-only">Create a new agent</DialogTitle>
            <div className="flex flex-col gap-8 p-3 pb-6">
              <DialogHeader className="font-tasa h-fit items-center justify-center gap-1.5 flex text-xl">
                <span className=" bg-mastra-bg-3 rounded h-7 w-7 grid place-items-center">
                  <Icon name="agent" />
                </span>
                <p> Create a new Agent</p>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-[18px] ">
                  <FormField
                    control={form.control}
                    name={'name'}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-mastra-el-3 text-xs font-medium">Name:</FormLabel>
                        <FormControl>
                          <Input
                            type={'text'}
                            className="placeholder:text-xs bg-white/5 overflow-ellipsis"
                            placeholder={''}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel className="text-mastra-el-3 text-xs font-medium">Entities to sync:</FormLabel>
                    <SelectDropDown
                      data={[
                        { name: 'entity-a', value: 'entity-a' },
                        { name: 'entity-b', value: 'entity-b' },
                      ]}
                      idKey="name"
                      selectedValues={syncedEntity}
                      setSelectedValues={setSyncedEntity}
                      placeholder="Entities to sync"
                    >
                      {syncedEntity.length >= 1 ? (
                        <div className="cursor-default flex items-center gap-2 px-2 py-1 border-[0.5px]  h-[34px] rounded border-mastra-border-1 bg-mastra-bg-6">
                          {syncedEntity.map(entity => (
                            <span
                              key={entity.value}
                              className="flex items-center gap-1 bg-mastra-bg-5 rounded  px-2 py-1"
                            >
                              <span className="text-xs">{entity.value}</span>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  removeSyncedEntity(entity.value);
                                }}
                                className="w-4 h-4 bg-mastra-bg-10/50 grid place-items-center rounded-full"
                              >
                                <Icon name="cancel" className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant={'ghost'}
                          className="w-full flex items-center justify-start h-[34px] cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
                        >
                          Select Entities to Sync
                        </Button>
                      )}
                    </SelectDropDown>
                  </FormItem>

                  <FormItem>
                    <FormLabel className="text-mastra-el-3 text-xs font-medium">Vector store:</FormLabel>
                    <SelectDropDown
                      idKey="name"
                      data={[{ name: 'store-a' }, { name: 'store-b' }]}
                      selectedValues={vectorStore}
                      setSelectedValues={setVectorStore}
                      placeholder="Vector store"
                      isSingleSelect
                    >
                      <Button
                        type="button"
                        variant={'ghost'}
                        className=" w-full flex items-center justify-start h-[34px] cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
                      >
                        {vectorStore.length === 1 ? vectorStore[0].name : 'Select vector store'}
                      </Button>
                    </SelectDropDown>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name={'ragPrompt'}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-mastra-el-3 text-xs font-medium">Rag prompt:</FormLabel>
                        <FormControl>
                          <Textarea
                            size="lg"
                            variant="default"
                            className="placeholder:text-xs bg-white/5 overflow-ellipsis"
                            placeholder={''}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <div className="flex gap-1.5 items-center">
                      <Checkbox id="refresh" />
                      <label
                        htmlFor="refresh"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Refresh the data
                      </label>
                    </div>
                  </FormItem>

                  <Button type="submit" className="h-10 w-full px-4 rounded">
                    Create Agent
                  </Button>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      </Header>
    </div>
  );
};
