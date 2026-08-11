import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Entity, EntityContent, EntityName, EntityDescription } from '@mastra/playground-ui/components/Entity';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { MemoryIcon } from '@mastra/playground-ui/icons/MemoryIcon';
import { Controller, useWatch } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { SectionHeader, SubSectionHeader } from '@/domains/cms';
import { useEmbedders } from '@/domains/embedders/hooks/use-embedders';
import { LLMProviders, LLMModels } from '@/domains/llm';
import { useVectors } from '@/domains/vectors/hooks/use-vectors';

export function MemoryPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const isEnabled = useWatch({ control, name: 'memory.enabled' }) ?? false;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Memory"
            subtitle="Configure memory settings for conversation persistence and semantic recall."
          />
          {!readOnly && isEnabled && (
            <Controller
              name="memory.enabled"
              control={control}
              render={({ field }) => <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />}
            />
          )}
        </div>

        {!isEnabled && (
          <div className="py-12">
            <EmptyState
              iconSlot={<MemoryIcon height={40} width={40} />}
              titleSlot="Memory is not enabled"
              descriptionSlot="Enable memory to store conversation history, add semantic recall for relevant retrieval, or observational memory for long-term learning."
              actionSlot={
                !readOnly && (
                  <Controller
                    name="memory.enabled"
                    control={control}
                    render={({ field }) => (
                      <Button variant="default" size="sm" onClick={() => field.onChange(true)}>
                        Enable Memory
                      </Button>
                    )}
                  />
                )
              }
            />
          </div>
        )}

        {isEnabled && (
          <div className="flex flex-col gap-2">
            <ObservationalMemoryEntity />
            <LastMessagesEntity />
            <SemanticRecallEntity />
            <ReadOnlyEntity />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function LastMessagesEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const lastMessages = useWatch({ control, name: 'memory.lastMessages' });
  const lastMessagesEnabled = lastMessages !== false;

  return (
    <Entity className="flex-col gap-0 overflow-hidden p-0">
      <div className="flex gap-3 px-4 py-3">
        <EntityContent>
          <EntityName>Message History</EntityName>
          <EntityDescription>Number of recent messages to include in context</EntityDescription>
        </EntityContent>

        {!readOnly && (
          <Controller
            name="memory.lastMessages"
            control={control}
            render={({ field }) => (
              <Switch
                checked={lastMessagesEnabled}
                onCheckedChange={checked => {
                  field.onChange(checked ? 40 : false);
                  if (checked) {
                    form.setValue('memory.observationalMemory.enabled', false, { shouldDirty: true });
                  }
                }}
              />
            )}
          />
        )}
      </div>

      {lastMessagesEnabled && (
        <div className="bg-surface2 border-border1 border-t p-4">
          <Controller
            name="memory.lastMessages"
            control={control}
            render={({ field }) => (
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
            )}
          />
        </div>
      )}
    </Entity>
  );
}

function SemanticRecallEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const semanticRecallEnabled = useWatch({ control, name: 'memory.semanticRecall' }) ?? false;

  const { data: vectorsData } = useVectors();
  const { data: embeddersData } = useEmbedders();
  const vectors = vectorsData?.vectors ?? [];
  const embedders = embeddersData?.embedders ?? [];

  return (
    <Entity className="flex-col gap-0 overflow-hidden p-0">
      <div className="flex gap-3 px-4 py-3">
        <EntityContent>
          <EntityName>Semantic Recall</EntityName>
          <EntityDescription>Enable semantic search in memory</EntityDescription>
        </EntityContent>

        {!readOnly && (
          <Controller
            name="memory.semanticRecall"
            control={control}
            render={({ field }) => <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />}
          />
        )}
      </div>

      {semanticRecallEnabled && (
        <div className="bg-surface2 border-border1 grid grid-cols-2 gap-4 border-t p-4">
          <Controller
            name="memory.vector"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="memory-vector" className="text-neutral5 text-sm">
                  Vector Store
                </Label>
                <span className="text-neutral2 text-xs">Select a vector store for semantic search</span>
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
                <Label htmlFor="memory-embedder" className="text-neutral5 text-sm">
                  Embedder Model
                </Label>
                <span className="text-neutral2 text-xs">Select an embedding model for semantic search</span>
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
        </div>
      )}
    </Entity>
  );
}

function ReadOnlyEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;

  return (
    <Entity>
      <EntityContent>
        <EntityName>Read Only</EntityName>
        <EntityDescription>Memory is read-only (no new messages stored)</EntityDescription>
      </EntityContent>

      {!readOnly && (
        <Controller
          name="memory.readOnly"
          control={control}
          render={({ field }) => <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />}
        />
      )}
    </Entity>
  );
}

function ObservationalMemoryEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const observationalMemoryEnabled = useWatch({ control, name: 'memory.observationalMemory.enabled' }) ?? false;

  return (
    <Entity className="flex-col gap-0 overflow-hidden p-0">
      <div className="flex gap-3 px-4 py-3">
        <EntityContent>
          <EntityName>Observational Memory</EntityName>
          <EntityDescription>
            Automatically observe and reflect on conversations to build long-term memory
          </EntityDescription>
        </EntityContent>

        {!readOnly && (
          <Controller
            name="memory.observationalMemory.enabled"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value ?? false}
                onCheckedChange={checked => {
                  field.onChange(checked);
                  if (checked) {
                    form.setValue('memory.lastMessages', false, { shouldDirty: true });
                  }
                }}
              />
            )}
          />
        )}
      </div>

      {observationalMemoryEnabled && (
        <div className="bg-surface2 border-border1 border-t p-4">
          <ObservationalMemoryFields />
        </div>
      )}
    </Entity>
  );
}

function ObservationalMemoryFields() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control, setValue } = form;
  const omProvider = useWatch({ control, name: 'memory.observationalMemory.model.provider' }) ?? '';
  const observerProvider = useWatch({ control, name: 'memory.observationalMemory.observation.model.provider' }) ?? '';
  const reflectorProvider = useWatch({ control, name: 'memory.observationalMemory.reflection.model.provider' }) ?? '';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-neutral5 text-sm">Provider</Label>
          <span className="text-neutral2 text-xs">Provider for the observer and reflector agents</span>
          <Controller
            name="memory.observationalMemory.model.provider"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMProviders
                  value={field.value ?? ''}
                  onValueChange={v => {
                    field.onChange(v);
                    setValue('memory.observationalMemory.model.name', '', { shouldDirty: true });
                  }}
                />
              </div>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-neutral5 text-sm">Model</Label>
          <span className="text-neutral2 text-xs">Model for the observer and reflector agents</span>
          <Controller
            name="memory.observationalMemory.model.name"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMModels value={field.value ?? ''} onValueChange={field.onChange} llmId={omProvider} />
              </div>
            )}
          />
        </div>

        <Controller
          name="memory.observationalMemory.scope"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memory-om-scope" className="text-neutral5 text-sm">
                Scope
              </Label>
              <span className="text-neutral2 text-xs">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memory-om-share-budget" className="text-neutral5 text-sm">
                Share Token Budget
              </Label>
              <span className="text-neutral2 text-xs">Share token budget between observation and reflection</span>
              <Switch
                id="memory-om-share-budget"
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
                disabled={readOnly}
              />
            </div>
          )}
        />
      </div>

      <div className="border-border1 mt-2 border-t pt-4">
        <ObserverFields observerProvider={observerProvider} />
      </div>
      <div className="border-border1 mt-2 border-t pt-4">
        <ReflectorFields reflectorProvider={reflectorProvider} />
      </div>
    </div>
  );
}

function ObserverFields({ observerProvider }: { observerProvider: string }) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control, setValue } = form;

  return (
    <div className="flex flex-col gap-4">
      <SubSectionHeader title="Observer" />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-neutral5 text-sm">Provider Override</Label>
          <span className="text-neutral2 text-xs">Override the default model provider for the observer</span>
          <Controller
            name="memory.observationalMemory.observation.model.provider"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMProviders
                  value={field.value ?? ''}
                  onValueChange={v => {
                    field.onChange(v);
                    setValue('memory.observationalMemory.observation.model.name', '', { shouldDirty: true });
                  }}
                />
              </div>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-neutral5 text-sm">Model Override</Label>
          <span className="text-neutral2 text-xs">Override the default model for the observer</span>
          <Controller
            name="memory.observationalMemory.observation.model.name"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMModels value={field.value ?? ''} onValueChange={field.onChange} llmId={observerProvider} />
              </div>
            )}
          />
        </div>

        <Controller
          name="memory.observationalMemory.observation.messageTokens"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memory-om-obs-msg-tokens" className="text-neutral5 text-sm">
                Message Tokens
              </Label>
              <span className="text-neutral2 text-xs">
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
              <Label htmlFor="memory-om-obs-batch" className="text-neutral5 text-sm">
                Max Tokens Per Batch
              </Label>
              <span className="text-neutral2 text-xs">
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
              <Label htmlFor="memory-om-obs-buffer" className="text-neutral5 text-sm">
                Buffer Tokens
              </Label>
              <span className="text-neutral2 text-xs">
                Token interval for async buffering (fraction of messageTokens or absolute count, empty to use default
                0.2, set 0 to disable)
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
              <Label htmlFor="memory-om-obs-buf-act" className="text-neutral5 text-sm">
                Buffer Activation
              </Label>
              <span className="text-neutral2 text-xs">
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
              <Label htmlFor="memory-om-obs-block" className="text-neutral5 text-sm">
                Block After
              </Label>
              <span className="text-neutral2 text-xs">
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
    </div>
  );
}

function ReflectorFields({ reflectorProvider }: { reflectorProvider: string }) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control, setValue } = form;

  return (
    <div className="flex flex-col gap-4">
      <SubSectionHeader title="Reflector" />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-neutral5 text-sm">Provider Override</Label>
          <span className="text-neutral2 text-xs">Override the default model provider for the reflector</span>
          <Controller
            name="memory.observationalMemory.reflection.model.provider"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMProviders
                  value={field.value ?? ''}
                  onValueChange={v => {
                    field.onChange(v);
                    setValue('memory.observationalMemory.reflection.model.name', '', { shouldDirty: true });
                  }}
                />
              </div>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-neutral5 text-sm">Model Override</Label>
          <span className="text-neutral2 text-xs">Override the default model for the reflector</span>
          <Controller
            name="memory.observationalMemory.reflection.model.name"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMModels value={field.value ?? ''} onValueChange={field.onChange} llmId={reflectorProvider} />
              </div>
            )}
          />
        </div>

        <Controller
          name="memory.observationalMemory.reflection.observationTokens"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memory-om-ref-obs-tokens" className="text-neutral5 text-sm">
                Observation Tokens
              </Label>
              <span className="text-neutral2 text-xs">
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
              <Label htmlFor="memory-om-ref-block" className="text-neutral5 text-sm">
                Block After
              </Label>
              <span className="text-neutral2 text-xs">
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
              <Label htmlFor="memory-om-ref-buf-act" className="text-neutral5 text-sm">
                Buffer Activation
              </Label>
              <span className="text-neutral2 text-xs">
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
    </div>
  );
}
