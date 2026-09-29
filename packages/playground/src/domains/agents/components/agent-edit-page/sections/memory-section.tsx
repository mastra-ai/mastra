import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { MemoryIcon } from '@mastra/playground-ui/icons/MemoryIcon';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { UseFormSetValue, Control } from 'react-hook-form';

import type { AgentFormValues } from '../utils/form-validation';
import { SectionTitle } from '@/domains/cms/components/section/section-title';
import { useEmbedders } from '@/domains/embedders/hooks/use-embedders';
import { LLMProviders, LLMModels } from '@/domains/llm';
import { useVectors } from '@/domains/vectors/hooks/use-vectors';

interface MemorySectionProps {
  control: Control<AgentFormValues>;
  setValue: UseFormSetValue<AgentFormValues>;
  readOnly?: boolean;
}

export function MemorySection({ control, setValue, readOnly = false }: MemorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isObserverOpen, setIsObserverOpen] = useState(false);
  const [isReflectorOpen, setIsReflectorOpen] = useState(false);
  const memoryConfig = useWatch({ control, name: 'memory' });
  const isEnabled = memoryConfig?.enabled ?? false;
  const semanticRecallEnabled = memoryConfig?.semanticRecall ?? false;
  const observationalMemoryEnabled = memoryConfig?.observationalMemory?.enabled ?? false;
  const omProvider = useWatch({ control, name: 'memory.observationalMemory.model.provider' }) ?? '';
  const observerProvider = useWatch({ control, name: 'memory.observationalMemory.observation.model.provider' }) ?? '';
  const reflectorProvider = useWatch({ control, name: 'memory.observationalMemory.reflection.model.provider' }) ?? '';

  const { data: vectorsData } = useVectors();
  const { data: embeddersData } = useEmbedders();
  const vectors = vectorsData?.vectors ?? [];
  const embedders = embeddersData?.embedders ?? [];

  return (
    <div className="rounded-md border border-border bg-background">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1 bg-card p-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <SectionTitle icon={<MemoryIcon className="text-muted-foreground" />}>
            Memory{isEnabled && <span className="text-success-indicator">(enabled)</span>}
          </SectionTitle>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-4 border-t border-border p-3">
            <Controller
              name="memory.enabled"
              control={control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent className="gap-0.5">
                    <FieldLabel>Enable Memory</FieldLabel>
                    <FieldDescription className="mt-0">Store and retrieve conversation history</FieldDescription>
                  </FieldContent>
                  <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={readOnly} />
                </Field>
              )}
            />

            {isEnabled && (
              <>
                <Controller
                  name="memory.lastMessages"
                  control={control}
                  render={({ field }) => (
                    <Field className="gap-1.5">
                      <FieldLabel>Last Messages</FieldLabel>
                      <FieldDescription className="mt-0">
                        Number of recent messages to include in context
                      </FieldDescription>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={field.value === false ? '' : (field.value ?? 40)}
                        onChange={e => {
                          const value = e.target.value;
                          field.onChange(value === '' ? false : parseInt(value, 10));
                        }}
                        placeholder="40"
                        className="bg-card"
                        disabled={readOnly}
                      />
                    </Field>
                  )}
                />

                <Controller
                  name="memory.semanticRecall"
                  control={control}
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <FieldContent className="gap-0.5">
                        <FieldLabel>Semantic Recall</FieldLabel>
                        <FieldDescription className="mt-0">Enable semantic search in memory</FieldDescription>
                      </FieldContent>
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={readOnly} />
                    </Field>
                  )}
                />

                {semanticRecallEnabled && (
                  <>
                    <Controller
                      name="memory.vector"
                      control={control}
                      render={({ field }) => (
                        <Field className="gap-1.5">
                          <FieldLabel>Vector Store</FieldLabel>
                          <FieldDescription className="mt-0">
                            Select a vector store for semantic search
                          </FieldDescription>
                          <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={readOnly}>
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Select a vector store" />
                            </SelectTrigger>
                            <SelectContent>
                              {vectors.map(vector => (
                                <SelectItem key={vector.id} value={vector.id}>
                                  {vector.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />

                    <Controller
                      name="memory.embedder"
                      control={control}
                      render={({ field }) => (
                        <Field className="gap-1.5">
                          <FieldLabel>Embedder Model</FieldLabel>
                          <FieldDescription className="mt-0">
                            Select an embedding model for semantic search
                          </FieldDescription>
                          <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={readOnly}>
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Select an embedder model" />
                            </SelectTrigger>
                            <SelectContent>
                              {embedders.map(embedder => (
                                <SelectItem key={embedder.id} value={embedder.id}>
                                  {embedder.name} ({embedder.provider})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />
                  </>
                )}

                <Controller
                  name="memory.readOnly"
                  control={control}
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <FieldContent className="gap-0.5">
                        <FieldLabel>Read Only</FieldLabel>
                        <FieldDescription className="mt-0">
                          Memory is read-only (no new messages stored)
                        </FieldDescription>
                      </FieldContent>
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={readOnly} />
                    </Field>
                  )}
                />

                <Controller
                  name="memory.observationalMemory.enabled"
                  control={control}
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <FieldContent className="gap-0.5">
                        <FieldLabel>Observational Memory</FieldLabel>
                        <FieldDescription className="mt-0">
                          Automatically observe and reflect on conversations to build long-term memory
                        </FieldDescription>
                      </FieldContent>
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={readOnly} />
                    </Field>
                  )}
                />

                {observationalMemoryEnabled && (
                  <div className="ml-2 flex flex-col gap-4 border-l-2 border-border pl-3">
                    <Field className="gap-1.5">
                      <FieldLabel>Provider</FieldLabel>
                      <FieldDescription className="mt-0">
                        Provider for the observer and reflector agents
                      </FieldDescription>
                      <Controller
                        name="memory.observationalMemory.model.provider"
                        control={control}
                        render={({ field }) => (
                          <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                            <LLMProviders
                              value={field.value ?? ''}
                              onValueChange={v => {
                                field.onChange(v);
                                setValue('memory.observationalMemory.model.name', '');
                              }}
                            />
                          </div>
                        )}
                      />
                    </Field>

                    <Field className="gap-1.5">
                      <FieldLabel>Model</FieldLabel>
                      <FieldDescription className="mt-0">Model for the observer and reflector agents</FieldDescription>
                      <Controller
                        name="memory.observationalMemory.model.name"
                        control={control}
                        render={({ field }) => (
                          <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                            <LLMModels value={field.value ?? ''} onValueChange={field.onChange} llmId={omProvider} />
                          </div>
                        )}
                      />
                    </Field>

                    <Controller
                      name="memory.observationalMemory.scope"
                      control={control}
                      render={({ field }) => (
                        <Field className="gap-1.5">
                          <FieldLabel>Scope</FieldLabel>
                          <FieldDescription className="mt-0">
                            Whether observations are scoped per thread or shared across all threads for a resource
                          </FieldDescription>
                          <Select value={field.value ?? 'thread'} onValueChange={field.onChange} disabled={readOnly}>
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="thread">Thread</SelectItem>
                              <SelectItem value="resource">Resource</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />

                    <Controller
                      name="memory.observationalMemory.shareTokenBudget"
                      control={control}
                      render={({ field }) => (
                        <Field orientation="horizontal">
                          <FieldContent className="gap-0.5">
                            <FieldLabel>Share Token Budget</FieldLabel>
                            <FieldDescription className="mt-0">
                              Share token budget between observation and reflection
                            </FieldDescription>
                          </FieldContent>
                          <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={readOnly} />
                        </Field>
                      )}
                    />

                    <Collapsible open={isObserverOpen} onOpenChange={setIsObserverOpen}>
                      <CollapsibleTrigger className="flex w-full items-center gap-1">
                        <ChevronRight
                          className={`h-3 w-3 text-muted-foreground transition-transform ${isObserverOpen ? 'rotate-90' : ''}`}
                        />
                        <span className="cursor-pointer text-label text-foreground">Observer</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-2 flex flex-col gap-4 border-l-2 border-border pl-3">
                          <Field className="gap-1.5">
                            <FieldLabel>Provider Override</FieldLabel>
                            <FieldDescription className="mt-0">
                              Override the default model provider for the observer
                            </FieldDescription>
                            <Controller
                              name="memory.observationalMemory.observation.model.provider"
                              control={control}
                              render={({ field }) => (
                                <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                                  <LLMProviders
                                    value={field.value ?? ''}
                                    onValueChange={v => {
                                      field.onChange(v);
                                      setValue('memory.observationalMemory.observation.model.name', '');
                                    }}
                                  />
                                </div>
                              )}
                            />
                          </Field>

                          <Field className="gap-1.5">
                            <FieldLabel>Model Override</FieldLabel>
                            <FieldDescription className="mt-0">
                              Override the default model for the observer
                            </FieldDescription>
                            <Controller
                              name="memory.observationalMemory.observation.model.name"
                              control={control}
                              render={({ field }) => (
                                <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                                  <LLMModels
                                    value={field.value ?? ''}
                                    onValueChange={field.onChange}
                                    llmId={observerProvider}
                                  />
                                </div>
                              )}
                            />
                          </Field>

                          <Controller
                            name="memory.observationalMemory.observation.messageTokens"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Message Tokens</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Token count of unobserved messages that triggers observation (default: 30000)
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseInt(v, 10));
                                  }}
                                  placeholder="30000"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.maxTokensPerBatch"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Max Tokens Per Batch</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Maximum tokens per batch when observing multiple threads (default: 10000)
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseInt(v, 10));
                                  }}
                                  placeholder="10000"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.bufferTokens"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Buffer Tokens</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Token interval for async buffering (fraction of messageTokens or absolute count, empty
                                  to use default 0.2, set 0 to disable)
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={field.value === false ? '0' : (field.value ?? '')}
                                  onChange={e => {
                                    const v = e.target.value;
                                    if (v === '' || v === undefined) {
                                      field.onChange(undefined);
                                    } else {
                                      const n = parseFloat(v);
                                      field.onChange(n === 0 ? false : n);
                                    }
                                  }}
                                  placeholder="0.2"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.bufferActivation"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Buffer Activation</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Ratio (0-1) of buffered observations to activate (default: 0.8)
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseFloat(v));
                                  }}
                                  placeholder="0.8"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.blockAfter"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Block After</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Multiplier or absolute token count for synchronous blocking (default: 1.2)
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseFloat(v));
                                  }}
                                  placeholder="1.2"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={isReflectorOpen} onOpenChange={setIsReflectorOpen}>
                      <CollapsibleTrigger className="flex w-full items-center gap-1">
                        <ChevronRight
                          className={`h-3 w-3 text-muted-foreground transition-transform ${isReflectorOpen ? 'rotate-90' : ''}`}
                        />
                        <span className="cursor-pointer text-label text-foreground">Reflector</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-2 flex flex-col gap-4 border-l-2 border-border pl-3">
                          <Field className="gap-1.5">
                            <FieldLabel>Provider Override</FieldLabel>
                            <FieldDescription className="mt-0">
                              Override the default model provider for the reflector
                            </FieldDescription>
                            <Controller
                              name="memory.observationalMemory.reflection.model.provider"
                              control={control}
                              render={({ field }) => (
                                <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                                  <LLMProviders
                                    value={field.value ?? ''}
                                    onValueChange={v => {
                                      field.onChange(v);
                                      setValue('memory.observationalMemory.reflection.model.name', '');
                                    }}
                                  />
                                </div>
                              )}
                            />
                          </Field>

                          <Field className="gap-1.5">
                            <FieldLabel>Model Override</FieldLabel>
                            <FieldDescription className="mt-0">
                              Override the default model for the reflector
                            </FieldDescription>
                            <Controller
                              name="memory.observationalMemory.reflection.model.name"
                              control={control}
                              render={({ field }) => (
                                <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                                  <LLMModels
                                    value={field.value ?? ''}
                                    onValueChange={field.onChange}
                                    llmId={reflectorProvider}
                                  />
                                </div>
                              )}
                            />
                          </Field>

                          <Controller
                            name="memory.observationalMemory.reflection.observationTokens"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Observation Tokens</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Token count of observations that triggers reflection (default: 40000)
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseInt(v, 10));
                                  }}
                                  placeholder="40000"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.reflection.blockAfter"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Block After</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Multiplier or absolute token count for synchronous blocking (default: 1.2)
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseFloat(v));
                                  }}
                                  placeholder="1.2"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.reflection.bufferActivation"
                            control={control}
                            render={({ field }) => (
                              <Field className="gap-1.5">
                                <FieldLabel>Buffer Activation</FieldLabel>
                                <FieldDescription className="mt-0">
                                  Ratio (0-1) controlling when async reflection buffering starts
                                </FieldDescription>
                                <Input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseFloat(v));
                                  }}
                                  placeholder="0.8"
                                  className="bg-card"
                                  disabled={readOnly}
                                />
                              </Field>
                            )}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
