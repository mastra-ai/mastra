'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import SelectDropDown from '@/components/ui/select-dropdown';
import { Textarea } from '@/components/ui/textarea';

import { cn } from '@/lib/utils';

import Icon from '@/app/components/icon';

import { AgentStructuredOutput } from './agent-structured-output';

type ModelProviders = { name: string; value: string; icon: 'openai-logomark' | 'anthropic-logomark' };

interface Model {
  id: string;
  name: string;
}

const modelProviders: Array<ModelProviders> = [
  {
    name: 'OpenAI (Assistant API)',
    value: 'open-ai-assistant',
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

const fetchModels = async ({ modelProvider, apiKey }: { modelProvider: string; apiKey: string }): Promise<Model[]> => {
  if (modelProvider === 'open-ai-assistant') {
    return fetchOpenAIModels(apiKey);
  } else if (modelProvider === 'open-ai-vercel') {
    return fetchOpenAIVercelModels(apiKey);
  } else if (modelProvider === 'anthropic') {
    return fetchVercelAnthropicModels(apiKey);
  }

  return [];
};

const formSchema = z.object({
  name: z.string().min(3, 'Agent name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  ragPrompt: z.string().min(1, 'Prompt is required for the model'),
});

export const AgentsCreationHeader = () => {
  const [show, setShow] = useState(false);
  const [isModelProviderOpen, setIsModelProviderOpen] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProviders[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState<Model[]>([]);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const form = useForm({
    defaultValues: {
      name: '',
      apiKey: '',
      ragPrompt: '',
      textResponseType: true,
      structuredResponseType: false,
      structuredResponse: {},
    },
    resolver: zodResolver(formSchema),
    reValidateMode: 'onSubmit',
  });

  const apiKey = form.watch('apiKey');
  const structuredResponseType = form.watch('structuredResponseType');
  const structuredResponse = form.watch('structuredResponse');
  const selectedModelProvider = modelProvider[0]?.value;

  useEffect(() => {
    if (selectedModelProvider && apiKey) {
      (async () => {
        const models = await fetchModels({ modelProvider: selectedModelProvider, apiKey });
        setModels(models);
      })();
    }
  }, [selectedModelProvider, apiKey]);

  const onSubmit = () => {};
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <section className="h-full border-[0.5px] border-t-0 border-b-0 border-l-0 border-mastra-border-1 flex-1">
          <h1 className="text-base px-[1.31rem] py-4 font-medium ">Agent info</h1>
          <div className="space-y-3 px-[1.31rem] py-4 pt-0">
            <FormField
              control={form.control}
              name={'name'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-mastra-el-3 text-xs font-medium">Name:</FormLabel>
                  <FormControl>
                    <Input
                      type={'text'}
                      className="placeholder:text-xs  py-5 bg-white/5 overflow-ellipsis"
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

            <div className="space-y-2 border border-mastra-border-1 rounded px-3 pt-2 py-4">
              <FormLabel className="text-mastra-el-3 text-xs font-medium">Model Provider:</FormLabel>
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

              {modelProvider.length > 0 && (
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
                            className="placeholder:text-xs py-5 bg-white/5 overflow-ellipsis"
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
              )}

              {models.length > 0 && (
                <div>
                  <FormLabel className="text-mastra-el-3 text-xs font-medium">Model:</FormLabel>
                  <SelectDropDown
                    idKey="id"
                    data={models}
                    selectedValues={model}
                    setSelectedValues={setModel}
                    placeholder="Model"
                    isSingleSelect
                    withCheckbox={false}
                    open={isModelOpen}
                    onOpenChange={setIsModelOpen}
                  >
                    <Button
                      type="button"
                      variant={'ghost'}
                      className=" w-full flex items-center justify-start h-[34px] mt-1 cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
                    >
                      {model[0]?.id ? <span> {model[0].id}</span> : 'Select model'}
                    </Button>
                  </SelectDropDown>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name={'ragPrompt'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-mastra-el-3 text-xs font-medium">Agent Instructions:</FormLabel>
                  <FormControl>
                    <Textarea
                      size="lg"
                      variant="default"
                      className="placeholder:text-xs !min-h-[271px] bg-white/5 overflow-ellipsis"
                      placeholder={''}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="text-mastra-el-3 text-xs font-medium">Response Type</p>
            <div className="flex gap-3">
              {/**hidden by default, auto-selected */}
              {/* <FormField
              control={form.control}
              name={'textResponseType'}
              render={({ field }) => (
                <FormItem className="space-y-0 flex items-center gap-1">
                  <FormControl>
                    <Checkbox checked={field.value} disabled />
                  </FormControl>
                  <FormLabel className="text-mastra-el-3 text-xs font-medium mt-0">Text response type</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
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
          </div>
        </section>
      </form>
    </Form>
  );
};
