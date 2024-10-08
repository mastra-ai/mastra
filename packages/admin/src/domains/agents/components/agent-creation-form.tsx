'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { HoverCard, HoverCardArrow, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import SelectDropDown from '@/components/ui/select-dropdown';
import Spinner from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import Icon from '@/app/components/icon';
import { IconName } from '@/types/icons';

import { saveAgent } from '../actions';

const buttonCopy = {
  idle: 'Create Agent',
  loading: <Spinner className="h-4 w-4" />,
  success: <Icon name="check" className="h-4 w-4" />,
};

const formSchema = z.object({
  name: z.string().min(3, 'Agent name is required'),
  ragPrompt: z.string().min(1, 'Prompt is required for the model'),
});

type ModelProviders = { name: string; value: string; icon: 'openai-logomark' | 'anthropic-logomark' };

const modelProviders: Array<ModelProviders> = [
  {
    name: 'OpenAI',
    value: 'open-ai',
    icon: 'openai-logomark',
  },
  {
    name: 'Anthropic',
    value: 'anthropic',
    icon: 'anthropic-logomark',
  },
];

type SelectValue<T> = { name: string; value: T };

export const AgentCreationForm = () => {
  const [buttonState, setButtonState] = useState<keyof typeof buttonCopy>('idle');
  const [syncedEntity, setSyncedEntity] = useState([] as Array<SelectValue<string>>);
  const [vectorStore, setVectorStore] = useState([] as Array<{ name: string }>);
  const [responseType, setResponseType] = useState([{ name: 'text response', value: 'text' }]);
  const [modelProvider, setModelProvider] = useState([{}] as Array<ModelProviders>);
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

    setButtonState('loading');

    //TODO: validate before save
    await saveAgent({
      agentId: crypto.randomUUID(),
      data: {
        name: agentDetails.name,
        agentType: 'RAG',
        entitites: syncedEntity,
        vectorStores: vectorStore,
        refreshAt: 0,
        prompt: agentDetails.ragPrompt,
        responseType: responseType[0].value,
      },
    });

    setButtonState('success');

    toast.success('Agent created 🦄.');
    await new Promise(res => setTimeout(res, 1000));

    setButtonState('idle');
    form.reset();
  };

  return (
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
      <DialogContent className="lg:!max-w-[55rem]">
        <DialogTitle className="sr-only">Create a new agent</DialogTitle>
        <div className="flex flex-col gap-8 p-3 pb-6">
          <DialogHeader className="font-tasa h-fit items-center justify-center gap-1.5 flex text-xl">
            <span className=" bg-mastra-bg-3 rounded h-7 w-7 grid place-items-center">
              <Icon name="agent" />
            </span>
            <p> Create a new Agent</p>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8 grid-cols-2">
              <div className="space-y-[18px]">
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
                          autoComplete="false"
                          autoCorrect="false"
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
                  <FormLabel className="text-mastra-el-3 text-xs font-medium">Model Provider:</FormLabel>
                  <SelectDropDown
                    idKey="value"
                    data={modelProviders}
                    selectedValues={modelProvider}
                    setSelectedValues={setModelProvider}
                    placeholder="Model provider"
                    isSingleSelect
                    withCheckbox={false}
                  >
                    <Button
                      type="button"
                      variant={'ghost'}
                      className=" w-full flex items-center justify-start h-[34px] cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
                    >
                      {modelProvider[0]?.value ? (
                        <span className="flex items-center gap-2">
                          <Icon
                            name={modelProvider[0]?.icon}
                            className={cn(
                              'w-3 h-3',
                              modelProvider[0].icon == 'anthropic-logomark' ? 'text-[#f0efe9]' : 'text-white',
                            )}
                          />
                          <span> {modelProvider[0].name}</span>
                        </span>
                      ) : (
                        'Select model provider'
                      )}
                    </Button>
                  </SelectDropDown>
                </FormItem>
                <FormItem>
                  <FormLabel className="text-mastra-el-3 flex items-center gap-1 text-xs font-medium">
                    <span>Type of Response:</span>
                    <HoverCard>
                      <HoverCardTrigger>
                        <Icon name="info" />
                        <span className="sr-only">What are responses?</span>
                      </HoverCardTrigger>
                      <HoverCardContent className="text-sm font-normal ">
                        The type of response the agent returns. Either Text for chatbot-like agents or structured
                        response(JSON) for agents in API environment
                        <HoverCardArrow className="fill-mastra-bg-3" />
                      </HoverCardContent>
                    </HoverCard>
                  </FormLabel>
                  <SelectDropDown
                    idKey="name"
                    data={[
                      { name: 'text response', value: 'text' },
                      { name: 'structured response (JSON)', value: 'json' },
                    ]}
                    selectedValues={responseType}
                    setSelectedValues={setResponseType}
                    placeholder="Response Type"
                    isSingleSelect
                  >
                    <Button
                      type="button"
                      variant={'ghost'}
                      className="w-full flex capitalize items-center justify-start h-[34px] cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
                    >
                      {responseType.length === 1 ? (
                        <span className="flex items-center gap-1">
                          <Icon
                            name={responseType[0].name === 'text' ? 'text' : ('json' as IconName)}
                            className="w-3 h-3"
                          />
                          <span>{responseType[0].name}</span>
                        </span>
                      ) : (
                        'Select response type'
                      )}
                    </Button>
                  </SelectDropDown>
                </FormItem>
              </div>

              <div className="space-y-[18px]">
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

                <Button type="submit" className="h-8 w-full px-4 rounded">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      transition={{
                        type: 'spring',
                        duration: 0.3,
                        bounce: 0,
                      }}
                      key={buttonState}
                      initial={{
                        y: -6,
                        opacity: 0,
                      }}
                      animate={{
                        y: 0,
                        opacity: 1,
                      }}
                      exit={{ opacity: 0, y: 6 }}
                    >
                      {buttonCopy[buttonState]}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
