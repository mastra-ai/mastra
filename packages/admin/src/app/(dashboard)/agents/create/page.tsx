'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import SelectDropDown from '@/components/ui/select-dropdown';
import { Textarea } from '@/components/ui/textarea';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

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

export default function Page() {
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
    },
    resolver: zodResolver(formSchema),
    reValidateMode: 'onSubmit',
  });

  const apiKey = form.watch('apiKey');
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
        <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
          <div className="h-fit items-center gap-1.5 flex">
            <span className=" bg-mastra-bg-3 rounded h-7 w-7 grid place-items-center">
              <Icon name="agent" className="w-3 h-3" />
            </span>
            <h1 className="text-base">Create New Agent</h1>
          </div>
        </div>
        <section className="grid h-[calc(100%-1.24rem)] gap-x-[0.62rem] grid-cols-[60rem_0.5px_1fr]">
          <div className="flex gap-2 flex-col">
            <div className="bg-mastra-bg-3 p-2 space-y-3 rounded flex-1">
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
              <div>
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
                    className=" w-full flex items-center justify-start h-[34px] mt-2 cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
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
              </div>

              {modelProvider.length > 0 && (
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-mastra-el-3 text-xs font-medium">API Key:</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
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
                      className=" w-full flex items-center justify-start h-[34px] mt-2 cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
                    >
                      {model[0]?.id ? <span> {model[0].id}</span> : 'Select model'}
                    </Button>
                  </SelectDropDown>
                </div>
              )}

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
                        className="placeholder:text-xs bg-white/5 overflow-ellipsis"
                        placeholder={''}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t p-2 border-mastra-border-1">
                <p>Structured output</p>
              </div>
            </div>
            <div className="bg-mastra-bg-3 rounded flex-1">The tools page</div>
          </div>
          <div>🦄</div>

          <div className="bg-mastra-bg-3 rounded w-full">The preview page</div>
        </section>
      </form>
    </Form>
  );
}
