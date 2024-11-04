'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useParams, useRouter } from 'next/navigation';

import Icon from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import SelectDropDown from '@/components/ui/select-dropdown';
import Spinner from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import {
  getApiKeyFromEnvAction,
  saveAgent,
  saveApiKeyToEnvAction,
  createOpenAiAssitant,
  updateOpenAiAssitant,
} from '../actions';
import { useAgentFormContext } from '../context/agent-form-context';

import { AgentStructuredOutput } from './agent-structured-output';

export type ModelProviders = {
  name: string;
  value: string;
  key: string;
  icon: 'openai-logomark' | 'anthropic-logomark';
};

interface Model {
  id: string;
  name: string;
  value: 'OPEN_AI_ASSISTANT' | 'OPEN_AI_VERCEL' | 'ANTHROPIC_VERCEL' | 'GROQ_VERCEL';
}

const modelProviders: Array<ModelProviders> = [
  {
    name: 'OpenAI (Assistant API)',
    value: 'OPEN_AI_ASSISTANT',
    key: 'OPENAI',
    icon: 'openai-logomark',
  },
  {
    name: 'OpenAI (Vercel AI SDK)',
    value: 'OPEN_AI_VERCEL',
    key: 'OPENAI',
    icon: 'openai-logomark',
  },
  {
    name: 'Anthropic (Vercel AI SDK)',
    value: 'ANTHROPIC_VERCEL',
    key: 'ANTHROPIC',
    icon: 'anthropic-logomark',
  },
  {
    name: 'Groq (Vercel AI SDK)',
    value: 'GROQ_VERCEL',
    key: 'GROQ',
    icon: 'anthropic-logomark',
  },
];

async function fetchOpenAIModels(apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const { data } = (await response.json()) as {
      data: {
        created: number;
        id: string;
        object: string;
        owned_by: string;
      }[];
    };

    return data.map(model => ({
      id: model.id,
      name: model.id,
    }));
  } catch (error) {
    console.error('Failed to fetch OpenAI models:', error);
    return [];
  }
}

async function fetchAnthropicModels(apiKey: string) {
  // They don't provide a public endpoint as of implementation
  return [
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ].map(id => ({ id, name: id }));
}

async function fetchGroqModels(apiKey: string) {
  // They don't provide a public endpoint as of implementation
  return [
    'llama3-groq-70b-8192-tool-use-preview',
    'llama3-groq-8b-8192-tool-use-preview',
    'gemma2-9b-it',
    'gemma-7b-it',
  ].map(id => ({ id, name: id }));
}

const fetchModels = async ({ modelProvider, apiKey }: { modelProvider: string; apiKey: string }): Promise<Model[]> => {
  if (modelProvider === 'OPEN_AI_ASSISTANT' || modelProvider === 'OPEN_AI_VERCEL') {
    return fetchOpenAIModels(apiKey) as Promise<Model[]>;
  } else if (modelProvider === 'ANTHROPIC_VERCEL') {
    return fetchAnthropicModels(apiKey) as Promise<Model[]>;
  } else if (modelProvider === 'GROQ_VERCEL') {
    return fetchGroqModels(apiKey) as Promise<Model[]>;
  }

  return [];
};

function sanitizePrompt(input: string) {
  return input.split('\n').join('\n');
}

const formSchema = z.object({
  name: z.string().min(3, 'Agent name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  ragPrompt: z.string().min(1, 'Prompt is required for the model'),
});

export const AgentInfoForm = () => {
  const { id: agentId } = useParams<{ id: string }>();
  const [show, setShow] = useState(false);
  const [isModelProviderOpen, setIsModelProviderOpen] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProviders[]>([]);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [model, setModel] = useState<Model[]>([]);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { agentInfo, tools, toolChoice, setAgentInfo, buttonContainer } = useAgentFormContext();

  const form = useForm({
    defaultValues: {
      name: agentInfo.name,
      apiKey: '',
      ragPrompt: agentInfo.agentInstructions,
      textResponseType: true,
      structuredResponseType: !!(agentInfo.outputs?.structured ? Object.keys(agentInfo.outputs?.structured).length : 0),
      structuredResponse: agentInfo.outputs?.structured,
    },
    resolver: zodResolver(formSchema),
  });

  const router = useRouter();

  const apiKey = form.watch('apiKey');
  const structuredResponseType = form.watch('structuredResponseType');
  const structuredResponse = form.watch('structuredResponse');
  const selectedModelProvider = modelProvider[0]?.value;
  const selectedModel = model[0]?.name;
  useEffect(() => {
    if (selectedModelProvider && apiKey) {
      (async () => {
        const models = await fetchModels({ modelProvider: selectedModelProvider as Model['value'], apiKey });
        setModels(models);
        if (agentId && agentInfo.model.name && !selectedModel) {
          const agentModel = models.find(m => m.id === agentInfo.model.name);
          if (agentModel) setModel([agentModel]);
        }
      })();
    }
  }, [selectedModelProvider, apiKey, agentInfo.model.name, agentId]);

  useEffect(() => {
    const populate = async () => {
      const agentModelProvider = modelProviders?.find(m => m.value === agentInfo.model.provider);
      if (agentModelProvider) {
        setModelProvider([agentModelProvider]);
        form.setValue('name', agentInfo.name);
        form.setValue('ragPrompt', agentInfo.agentInstructions);
        form.setValue('structuredResponse', agentInfo.outputs.structured);
        form.setValue('structuredResponseType', !!Object.keys(agentInfo.outputs.structured).length);
        const apiKey = await getApiKeyFromEnvAction(agentModelProvider.key);

        if (apiKey) {
          form.setValue('apiKey', apiKey);
        } else {
          form.setValue('apiKey', '');
        }
      }
    };

    if (agentId && agentInfo.model.provider && !selectedModelProvider) {
      populate();
    }
  }, [agentInfo, agentId]);

  const handleSubmit = async () => {
    setIsLoading(true);
    const name = form.getValues('name');
    const prompt = form.getValues('ragPrompt');
    const apiKey = form.getValues('apiKey');
    const structuredResponse = form.getValues('structuredResponse');
    const structuredResponseType = form.getValues('structuredResponseType');
    if (!name) {
      toast.error('Please fill out the name of the agent');
      return;
    }

    if (!prompt) {
      toast.error('Please fill out a model prompt');
      return;
    }

    if (!apiKey) {
      toast.error('Please add in your Api key');
      return;
    }

    const updateAgentInfo = {
      name,
      agentInstructions: sanitizePrompt(prompt),
      model: {
        provider: selectedModelProvider,
        name: selectedModel,
        toolChoice,
      },
      outputs: {
        text: true,
        structured: structuredResponseType ? structuredResponse : {},
      },
    } as const;

    setAgentInfo(prev => ({
      ...prev,
      ...updateAgentInfo,
    }));

    try {
      let id = agentId || crypto.randomUUID();

      //if OPEN_AI_ASSISTANT,create the assistant in openAi
      if (updateAgentInfo.model.provider === 'OPEN_AI_ASSISTANT') {
        if (agentId) {
          await updateOpenAiAssitant({
            id,
            name: updateAgentInfo.name,
            instructions: updateAgentInfo.agentInstructions,
            model: updateAgentInfo.model.name,
            tools: tools as Record<string, boolean>,
          });
        } else {
          const openAiAssitant = await createOpenAiAssitant({
            name: updateAgentInfo.name,
            instructions: updateAgentInfo.agentInstructions,
            model: updateAgentInfo.model.name,
            tools: tools as Record<string, boolean>,
          });

          id = openAiAssitant?.id!;
        }
      }
      const agent = {
        id,
        ...updateAgentInfo,
        tools,
      };

      await saveAgent({ agentId: id, data: agent });
      toast.success(agentId ? 'Agent updated' : 'Agent created');
      router.push('/agents');
    } catch (err) {
      toast.error(agentId ? 'Error updating agent' : 'Error creating agent');
      setIsLoading(false);
    }
  };

  const isDisabled =
    !agentInfo.name || !agentInfo.agentInstructions || !agentInfo.model.name || !agentInfo.model.provider;

  const handleApiKeyBlur = async () => {
    const mProvider = modelProvider[0]?.key;
    if (apiKey && mProvider) {
      await saveApiKeyToEnvAction({
        modelProvider: mProvider,
        apiKey,
      });
    }
  };

  return (
    <Form {...form}>
      <ScrollArea className="border-[0.5px] border-t-0 border-b-0 border-l-0 border-mastra-border-1 flex-1">
        <form>
          <section className="h-full ">
            <h1 className="text-base px-[1.31rem] py-4 font-medium ">Agent info</h1>
            <div className="space-y-3 px-[1.31rem] py-4 pt-0">
              <FormField
                control={form.control}
                name={'name'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-mastra-el-3 text-xs font-medium">
                      Name <span>(required)</span>:
                    </FormLabel>
                    <FormControl>
                      <Input
                        type={'text'}
                        className="placeholder:text-xs  py-5 bg-white/5 overflow-ellipsis"
                        placeholder={''}
                        autoComplete="false"
                        autoCorrect="false"
                        autoCapitalize="off"
                        {...field}
                        onBlur={e =>
                          setAgentInfo(prev => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2 border border-mastra-border-1 rounded px-3 pt-2 py-4">
                <FormLabel className="text-mastra-el-3 text-xs font-medium">
                  Model Provider <span>(required)</span>:
                </FormLabel>
                <SelectDropDown
                  idKey="value"
                  data={modelProviders}
                  selectedValues={modelProvider}
                  setSelectedValues={setModelProvider}
                  placeholder="Model provider"
                  isSingleSelect
                  withCheckbox={false}
                  open={isModelProviderOpen}
                  onOpenChange={setIsModelProviderOpen}
                  onSelectItem={async item => {
                    setAgentInfo(prev => ({
                      ...prev,
                      model: {
                        ...prev.model,
                        provider: item.value,
                      },
                    }));

                    const apiKey = await getApiKeyFromEnvAction(item.key);

                    if (apiKey) {
                      form.setValue('apiKey', apiKey);
                    } else {
                      form.setValue('apiKey', '');
                    }
                    setIsModelProviderOpen(false);
                  }}
                >
                  <Button
                    type="button"
                    variant={'ghost'}
                    className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
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
                    <Icon name="down-caret" className="ml-auto h-4 w-4" />
                  </Button>
                </SelectDropDown>
                <AnimatePresence>
                  {modelProvider.length > 0 && (
                    <motion.div
                      key={'apiKey'}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{
                        type: 'spring',
                        bounce: 0,
                        duration: 0.5,
                      }}
                    >
                      <div className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-mastra-el-3 text-xs font-medium">API Key:</FormLabel>
                              <FormControl>
                                <Input
                                  type={show ? 'text' : 'password'}
                                  className="placeholder:text-xs py-5 font-mono bg-white/5 overflow-ellipsis"
                                  placeholder={''}
                                  autoComplete="false"
                                  autoCorrect="false"
                                  {...field}
                                  onBlur={handleApiKeyBlur}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          className="w-[68px] font-mono text-sm self-end"
                          onClick={() => setShow(prev => !prev)}
                        >
                          {show ? 'hide' : 'show'}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {models.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{
                        type: 'spring',
                        bounce: 0,
                        duration: 0.5,
                      }}
                    >
                      <FormLabel className="text-mastra-el-3 text-xs font-medium">Model:</FormLabel>
                      <SelectDropDown
                        idKey="id"
                        data={models as Model[]}
                        selectedValues={model}
                        setSelectedValues={setModel}
                        placeholder="Model"
                        isSingleSelect
                        withCheckbox={false}
                        open={isModelOpen}
                        onOpenChange={setIsModelOpen}
                        onSelectItem={item => {
                          setAgentInfo(prev => ({
                            ...prev,
                            model: {
                              ...prev.model,
                              name: item.id,
                            },
                          }));
                        }}
                      >
                        <Button
                          type="button"
                          variant={'ghost'}
                          className=" w-full flex items-center justify-start h-[34px] mt-1 cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
                        >
                          {model[0]?.id ? <span> {model[0].id}</span> : 'Select model'}

                          <Icon name="down-caret" className="ml-auto h-4 w-4" />
                        </Button>
                      </SelectDropDown>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <FormField
                control={form.control}
                name={'ragPrompt'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-mastra-el-3 text-xs font-medium">
                      Agent Instructions <span>(required)</span>:
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        size="lg"
                        variant="default"
                        className="placeholder:text-xs !min-h-[271px] bg-white/5 overflow-ellipsis"
                        placeholder={''}
                        {...field}
                        onBlur={e =>
                          setAgentInfo(prev => ({
                            ...prev,
                            agentInstructions: e.target.value,
                          }))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-mastra-el-3 text-xs font-medium">Response Type</p>
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name={'structuredResponseType'}
                  render={({ field }) => (
                    <FormItem className="space-y-0 flex items-center gap-1">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="text-mastra-el-3 text-xs font-medium mt-0">
                        Structured response type (JSON)
                      </FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <AnimatePresence>
                {structuredResponseType ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{
                      type: 'spring',
                      bounce: 0,
                      duration: 0.5,
                    }}
                  >
                    <AgentStructuredOutput
                      structuredResponse={structuredResponse}
                      onSaveOutput={resp => {
                        form.setValue('structuredResponse', resp);
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {buttonContainer
                ? createPortal(
                    <Button
                      onClick={() => {
                        handleSubmit();
                      }}
                      disabled={isDisabled || isLoading}
                      type="submit"
                      className=" w-full py-1 px-4 flex justify-center rounded"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-1">
                          <Spinner className="w-3 h-3" />
                          {agentId ? 'Updating Agent' : 'Creating Agent'}
                        </span>
                      ) : agentId ? (
                        'Update Agent'
                      ) : (
                        'Create Agent'
                      )}
                    </Button>,
                    buttonContainer as Element,
                  )
                : null}
            </div>
          </section>
        </form>
      </ScrollArea>
    </Form>
  );
};
