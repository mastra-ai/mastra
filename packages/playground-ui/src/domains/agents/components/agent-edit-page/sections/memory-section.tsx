import { useState } from 'react';
import { Controller, Control, useWatch, type UseFormSetValue } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';

import { MemoryIcon } from '@/ds/icons';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { Label } from '@/ds/components/Label';
import { Input } from '@/ds/components/Input';
import { Switch } from '@/ds/components/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import type { AgentFormValues } from '../utils/form-validation';
import { SectionTitle } from '@/domains/cms/components/section/section-title';
import { useVectors } from '@/domains/vectors/hooks/use-vectors';
import { useEmbedders } from '@/domains/embedders/hooks/use-embedders';
import { LLMProviders, LLMModels } from '@/domains/llm';

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
    <div className="rounded-md border border-border1 bg-surface2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 w-full p-3 bg-surface3">
          <ChevronRight className="h-4 w-4 text-neutral3" />
          <SectionTitle icon={<MemoryIcon className="text-neutral3" />}>
            Memory{isEnabled && <span className="text-accent1 font-normal">(enabled)</span>}
          </SectionTitle>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 border-t border-border1 flex flex-col gap-4">
            <Controller
              name="memory.enabled"
              control={control}
              render={({ field }) => (
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="memory-enabled" className="text-sm text-neutral5">
                      Enable Memory
                    </Label>
                    <span className="text-xs text-neutral3">Store and retrieve conversation history</span>
                  </div>
                  <Switch
                    id="memory-enabled"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={readOnly}
                  />
                </div>
              )}
            />

            {isEnabled && (
              <>
                <Controller
                  name="memory.lastMessages"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="memory-last-messages" className="text-xs text-neutral4">
                        Last Messages
                      </Label>
                      <span className="text-xs text-neutral3">Number of recent messages to include in context</span>
                      <Input
                        id="memory-last-messages"
                        type="number"
                        min="1"
                        step="1"
                        value={field.value === false ? '' : (field.value ?? 40)}
                        onChange={e => {
                          const value = e.target.value;
                          field.onChange(value === '' ? false : parseInt(value, 10));
                        }}
                        placeholder="40"
                        className="bg-surface3"
                        disabled={readOnly}
                      />
                    </div>
                  )}
                />

                <Controller
                  name="memory.semanticRecall"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="memory-semantic-recall" className="text-sm text-neutral5">
                          Semantic Recall
                        </Label>
                        <span className="text-xs text-neutral3">Enable semantic search in memory</span>
                      </div>
                      <Switch
                        id="memory-semantic-recall"
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        disabled={readOnly}
                      />
                    </div>
                  )}
                />

                {semanticRecallEnabled && (
                  <>
                    <Controller
                      name="memory.vector"
                      control={control}
                      render={({ field }) => (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="memory-vector" className="text-xs text-neutral4">
                            Vector Store
                          </Label>
                          <span className="text-xs text-neutral3">Select a vector store for semantic search</span>
                          <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={readOnly}>
                            <SelectTrigger id="memory-vector" className="bg-surface3">
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
                        </div>
                      )}
                    />

                    <Controller
                      name="memory.embedder"
                      control={control}
                      render={({ field }) => (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="memory-embedder" className="text-xs text-neutral4">
                            Embedder Model
                          </Label>
                          <span className="text-xs text-neutral3">Select an embedding model for semantic search</span>
                          <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={readOnly}>
                            <SelectTrigger id="memory-embedder" className="bg-surface3">
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
                        </div>
                      )}
                    />
                  </>
                )}

                <Controller
                  name="memory.readOnly"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="memory-read-only" className="text-sm text-neutral5">
                          Read Only
                        </Label>
                        <span className="text-xs text-neutral3">Memory is read-only (no new messages stored)</span>
                      </div>
                      <Switch
                        id="memory-read-only"
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        disabled={readOnly}
                      />
                    </div>
                  )}
                />

                <Controller
                  name="memory.observationalMemory.enabled"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="memory-observational" className="text-sm text-neutral5">
                          Observational Memory
                        </Label>
                        <span className="text-xs text-neutral3">
                          Automatically observe and reflect on conversations to build long-term memory
                        </span>
                      </div>
                      <Switch
                        id="memory-observational"
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        disabled={readOnly}
                      />
                    </div>
                  )}
                />

                {observationalMemoryEnabled && (
                  <div className="ml-2 pl-3 border-l-2 border-border1 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-neutral4">Provider</Label>
                      <span className="text-xs text-neutral3">Provider for the observer and reflector agents</span>
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
                              variant="light"
                            />
                          </div>
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-neutral4">Model</Label>
                      <span className="text-xs text-neutral3">Model for the observer and reflector agents</span>
                      <Controller
                        name="memory.observationalMemory.model.name"
                        control={control}
                        render={({ field }) => (
                          <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                            <LLMModels
                              value={field.value ?? ''}
                              onValueChange={field.onChange}
                              llmId={omProvider}
                              variant="light"
                            />
                          </div>
                        )}
                      />
                    </div>

                    <Controller
                      name="memory.observationalMemory.scope"
                      control={control}
                      render={({ field }) => (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="memory-om-scope" className="text-xs text-neutral4">
                            Scope
                          </Label>
                          <span className="text-xs text-neutral3">
                            Whether observations are scoped per thread or shared across all threads for a resource
                          </span>
                          <Select value={field.value ?? 'thread'} onValueChange={field.onChange} disabled={readOnly}>
                            <SelectTrigger id="memory-om-scope" className="bg-surface3">
                              <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="thread">Thread</SelectItem>
                              <SelectItem value="resource">Resource</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    />

                    <Controller
                      name="memory.observationalMemory.shareTokenBudget"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <Label htmlFor="memory-om-share-budget" className="text-sm text-neutral5">
                              Share Token Budget
                            </Label>
                            <span className="text-xs text-neutral3">
                              Share token budget between observation and reflection
                            </span>
                          </div>
                          <Switch
                            id="memory-om-share-budget"
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                            disabled={readOnly}
                          />
                        </div>
                      )}
                    />

                    {/* Observer Configuration */}
                    <Collapsible open={isObserverOpen} onOpenChange={setIsObserverOpen}>
                      <CollapsibleTrigger className="flex items-center gap-1 w-full">
                        <ChevronRight
                          className={`h-3 w-3 text-neutral3 transition-transform ${isObserverOpen ? 'rotate-90' : ''}`}
                        />
                        <Label className="text-sm text-neutral5 cursor-pointer">Observer</Label>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-2 pl-3 border-l-2 border-border1 mt-2 flex flex-col gap-4">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-neutral4">Provider Override</Label>
                            <span className="text-xs text-neutral3">
                              Override the default model provider for the observer
                            </span>
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
                                    variant="light"
                                  />
                                </div>
                              )}
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-neutral4">Model Override</Label>
                            <span className="text-xs text-neutral3">Override the default model for the observer</span>
                            <Controller
                              name="memory.observationalMemory.observation.model.name"
                              control={control}
                              render={({ field }) => (
                                <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                                  <LLMModels
                                    value={field.value ?? ''}
                                    onValueChange={field.onChange}
                                    llmId={observerProvider}
                                    variant="light"
                                  />
                                </div>
                              )}
                            />
                          </div>

                          <Controller
                            name="memory.observationalMemory.observation.messageTokens"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-obs-msg-tokens" className="text-xs text-neutral4">
                                  Message Tokens
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Token count of unobserved messages that triggers observation (default: 30000)
                                </span>
                                <Input
                                  id="memory-om-obs-msg-tokens"
                                  type="number"
                                  min="1"
                                  step="1000"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseInt(v, 10));
                                  }}
                                  placeholder="30000"
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.maxTokensPerBatch"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-obs-batch" className="text-xs text-neutral4">
                                  Max Tokens Per Batch
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Maximum tokens per batch when observing multiple threads (default: 10000)
                                </span>
                                <Input
                                  id="memory-om-obs-batch"
                                  type="number"
                                  min="1"
                                  step="1000"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseInt(v, 10));
                                  }}
                                  placeholder="10000"
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.bufferTokens"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-obs-buffer" className="text-xs text-neutral4">
                                  Buffer Tokens
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Token interval for async buffering (fraction of messageTokens or absolute count, empty
                                  to use default 0.2, set 0 to disable)
                                </span>
                                <Input
                                  id="memory-om-obs-buffer"
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
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.bufferActivation"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-obs-buf-act" className="text-xs text-neutral4">
                                  Buffer Activation
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Ratio (0-1) of buffered observations to activate (default: 0.8)
                                </span>
                                <Input
                                  id="memory-om-obs-buf-act"
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
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.observation.blockAfter"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-obs-block" className="text-xs text-neutral4">
                                  Block After
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Multiplier or absolute token count for synchronous blocking (default: 1.2)
                                </span>
                                <Input
                                  id="memory-om-obs-block"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseFloat(v));
                                  }}
                                  placeholder="1.2"
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Reflector Configuration */}
                    <Collapsible open={isReflectorOpen} onOpenChange={setIsReflectorOpen}>
                      <CollapsibleTrigger className="flex items-center gap-1 w-full">
                        <ChevronRight
                          className={`h-3 w-3 text-neutral3 transition-transform ${isReflectorOpen ? 'rotate-90' : ''}`}
                        />
                        <Label className="text-sm text-neutral5 cursor-pointer">Reflector</Label>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-2 pl-3 border-l-2 border-border1 mt-2 flex flex-col gap-4">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-neutral4">Provider Override</Label>
                            <span className="text-xs text-neutral3">
                              Override the default model provider for the reflector
                            </span>
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
                                    variant="light"
                                  />
                                </div>
                              )}
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-neutral4">Model Override</Label>
                            <span className="text-xs text-neutral3">Override the default model for the reflector</span>
                            <Controller
                              name="memory.observationalMemory.reflection.model.name"
                              control={control}
                              render={({ field }) => (
                                <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                                  <LLMModels
                                    value={field.value ?? ''}
                                    onValueChange={field.onChange}
                                    llmId={reflectorProvider}
                                    variant="light"
                                  />
                                </div>
                              )}
                            />
                          </div>

                          <Controller
                            name="memory.observationalMemory.reflection.observationTokens"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-ref-obs-tokens" className="text-xs text-neutral4">
                                  Observation Tokens
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Token count of observations that triggers reflection (default: 40000)
                                </span>
                                <Input
                                  id="memory-om-ref-obs-tokens"
                                  type="number"
                                  min="1"
                                  step="1000"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseInt(v, 10));
                                  }}
                                  placeholder="40000"
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.reflection.blockAfter"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-ref-block" className="text-xs text-neutral4">
                                  Block After
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Multiplier or absolute token count for synchronous blocking (default: 1.2)
                                </span>
                                <Input
                                  id="memory-om-ref-block"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={field.value ?? ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    field.onChange(v === '' ? undefined : parseFloat(v));
                                  }}
                                  placeholder="1.2"
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          />

                          <Controller
                            name="memory.observationalMemory.reflection.bufferActivation"
                            control={control}
                            render={({ field }) => (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="memory-om-ref-buf-act" className="text-xs text-neutral4">
                                  Buffer Activation
                                </Label>
                                <span className="text-xs text-neutral3">
                                  Ratio (0-1) controlling when async reflection buffering starts
                                </span>
                                <Input
                                  id="memory-om-ref-buf-act"
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
                                  className="bg-surface3"
                                  disabled={readOnly}
                                />
                              </div>
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
