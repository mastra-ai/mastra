import { useState } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';
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

interface MemorySectionProps {
  control: Control<AgentFormValues>;
  readOnly?: boolean;
}

export function MemorySection({ control, readOnly = false }: MemorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const memoryConfig = useWatch({ control, name: 'memory' });
  const isEnabled = memoryConfig?.enabled ?? false;
  const semanticRecallEnabled = memoryConfig?.semanticRecall ?? false;

  const { data: vectorsData } = useVectors();
  const { data: embeddersData } = useEmbedders();
  const vectors = vectorsData?.vectors ?? [];
  const embedders = embeddersData?.embedders ?? [];

  return (
    <div className="rounded-md border border-border1 bg-surface2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 w-full p-3 bg-surface3">
          <ChevronRight className="h-4 w-4 text-icon3" />
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
                    <Label htmlFor="memory-enabled" className="text-sm text-icon5">
                      Enable Memory
                    </Label>
                    <span className="text-xs text-icon3">Store and retrieve conversation history</span>
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
                      <Label htmlFor="memory-last-messages" className="text-xs text-icon4">
                        Last Messages
                      </Label>
                      <span className="text-xs text-icon3">Number of recent messages to include in context</span>
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
                        <Label htmlFor="memory-semantic-recall" className="text-sm text-icon5">
                          Semantic Recall
                        </Label>
                        <span className="text-xs text-icon3">Enable semantic search in memory</span>
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
                          <Label htmlFor="memory-vector" className="text-xs text-icon4">
                            Vector Store
                          </Label>
                          <span className="text-xs text-icon3">Select a vector store for semantic search</span>
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
                          <Label htmlFor="memory-embedder" className="text-xs text-icon4">
                            Embedder Model
                          </Label>
                          <span className="text-xs text-icon3">Select an embedding model for semantic search</span>
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
                        <Label htmlFor="memory-read-only" className="text-sm text-icon5">
                          Read Only
                        </Label>
                        <span className="text-xs text-icon3">Memory is read-only (no new messages stored)</span>
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
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
