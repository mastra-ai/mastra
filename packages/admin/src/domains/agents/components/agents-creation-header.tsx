'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import SelectDropDown from '@/components/ui/select-dropdown';
import { Textarea } from '@/components/ui/textarea';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import Icon from '@/app/components/icon';

import { saveAgent } from '../actions';
import { useAgentFormContext } from '../context/agent-form-context';

import { AgentStructuredOutput } from './agent-structured-output';

type ModelProviders = { name: string; value: string; icon: 'openai-logomark' | 'anthropic-logomark' };

interface Model {
  id: string;
  name: string;
  value: 'OPEN_AI_ASSISTANT' | 'open-ai-vercel' | 'anthropic';
}

const modelProviders: Array<ModelProviders> = [
  {
    name: 'OpenAI (Assistant API)',
    value: 'OPEN_AI_ASSISTANT',
    icon: 'openai-logomark',
  },
  {
    name: 'OpenAI (Vercel AI SDK)',
    value: 'open-ai-vercel',
    icon: 'openai-logomark',
  },
  {
    name: 'Anthropic (Vercel AI SDK)',
    value: 'anthropic',
    icon: 'anthropic-logomark',
  },
];

async function fetchOpenAIModels(apiKey: string) {
  console.log('got here');
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

async function fetchOpenAIVercelModels(apiKey: string) {
  // TODO: Implement fetching models from Vercel AI SDK
  return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'].map(id => ({
    id,
    name: id,
  }));
}

async function fetchVercelAnthropicModels(apiKey: string) {
  // TODO: Implement fetching models from Vercel Anthropic SDK
  return [
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ].map(id => ({ id, name: id }));
}

const fetchModels = async ({
  modelProvider,
  apiKey,
}: {
  modelProvider: Model['value'];
  apiKey: string;
}): Promise<{ id: string; name: string }[]> => {
  if (modelProvider === 'OPEN_AI_ASSISTANT') {
    return fetchOpenAIModels(apiKey);
  } else if (modelProvider === 'open-ai-vercel') {
    return fetchOpenAIVercelModels(apiKey);
  } else if (modelProvider === 'anthropic') {
    return fetchVercelAnthropicModels(apiKey);
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

export const AgentsCreationHeader = () => {
  const [show, setShow] = useState(false);
  const [isModelProviderOpen, setIsModelProviderOpen] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProviders[]>([]);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [model, setModel] = useState<Model[]>([]);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const { agentInfo, tools, toolChoice, setAgentInfo, buttonContainer } = useAgentFormContext();
  const form = useForm({
    defaultValues: {
      name: agentInfo.name,
      apiKey: '',
      ragPrompt: agentInfo.agentInstructions,
      textResponseType: true,
      structuredResponseType: false,
      structuredResponse: agentInfo.outputs.structured,
    },
    resolver: zodResolver(formSchema),
  });

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
      })();
    }
  }, [selectedModelProvider, apiKey]);

  const handleSubmit = async () => {
    const name = form.getValues('name');
    const prompt = form.getValues('ragPrompt');
    const apiKey = form.getValues('apiKey');
    const structuredResponse = form.getValues('structuredResponse');
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
      },
      outputs: {
        text: true,
        structured: structuredResponse,
      },
    } as const;

    setAgentInfo(prev => ({
      ...prev,
      ...updateAgentInfo,
    }));

    const id = crypto.randomUUID();
    const agent = {
      id,
      ...updateAgentInfo,
      tools,
      toolChoice,
    };

    await saveAgent({ agentId: id, data: agent });
    toast.success('Agent created');
  };

  const isDisabled =
    !agentInfo.name || !agentInfo.agentInstructions || !agentInfo.model.name || !agentInfo.model.provider;

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
                  onSelectItem={item => {
                    setAgentInfo(prev => ({
                      ...prev,
                      model: {
                        ...prev.model,
                        provider: item.value,
                      },
                    }));
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
                                  onBlur={() => {
                                    // TODO: save api key to .env
                                  }}
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
              {structuredResponseType ? (
                <AgentStructuredOutput
                  structuredResponse={structuredResponse}
                  onSaveOutput={resp => {
                    form.setValue('structuredResponse', resp);
                  }}
                />
              ) : null}

              {buttonContainer
                ? createPortal(
                    <Button
                      onClick={() => {
                        handleSubmit();
                      }}
                      disabled={isDisabled}
                      type="submit"
                      className="h-10 w-full py-1 px-4 flex justify-center rounded"
                    >
                      Create Agent
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
