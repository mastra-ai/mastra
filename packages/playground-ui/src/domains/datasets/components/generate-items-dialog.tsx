import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Trash2, Plus } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { Spinner } from '@/ds/components/Spinner';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Checkbox } from '@/ds/components/Checkbox';
import { Input } from '@/ds/components/Input';
import { toast } from '@/lib/toast';
import { LLMProviders, LLMModels, cleanProviderId } from '@/domains/llm';
import { usePlaygroundModel } from '@/domains/agents/context/playground-model-context';

import { useDatasetMutations } from '../hooks/use-dataset-mutations';

interface GeneratedItem {
  input: unknown;
  groundTruth?: unknown;
}

interface AgentContext {
  description?: string;
  instructions?: string;
  tools?: string[];
}

interface GenerateItemsDialogProps {
  datasetId: string;
  agentContext?: AgentContext;
  onDismiss: () => void;
}

function buildDefaultPrompt(agentContext?: AgentContext): string {
  const parts: string[] = [];
  if (agentContext?.description) {
    parts.push(`Generate diverse test inputs for an agent that ${agentContext.description.toLowerCase()}.`);
  } else {
    parts.push('Generate diverse test inputs for this agent.');
  }
  if (agentContext?.tools?.length) {
    parts.push(`The agent has these tools: ${agentContext.tools.join(', ')}.`);
  }
  parts.push('Include edge cases, typical usage, and adversarial inputs.');
  return parts.join(' ');
}

/**
 * Two-phase dialog for generating dataset items:
 * 1. Config phase — user sets prompt, count, clicks Generate
 * 2. Generation runs in background (config dialog closes, toast shown)
 * 3. Review phase — dialog auto-opens with generated items for selection
 *
 * Parent keeps this mounted while generateDatasetId is set.
 * Call onDismiss to tell parent to unmount.
 */
export function GenerateItemsDialog({ datasetId, agentContext, onDismiss }: GenerateItemsDialogProps) {
  const { provider: ctxProvider, model: ctxModel } = usePlaygroundModel();
  const [localProvider, setLocalProvider] = useState(ctxProvider);
  const [localModel, setLocalModel] = useState(ctxModel);
  const modelId = localProvider && localModel ? `${localProvider}/${localModel}` : '';

  const [prompt, setPrompt] = useState(() => buildDefaultPrompt(agentContext));
  const [count, setCount] = useState(5);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [showConfig, setShowConfig] = useState(true);
  const [showReview, setShowReview] = useState(false);

  const cancelledRef = useRef(false);

  const { generateItems, batchInsertItems } = useDatasetMutations();

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!modelId) {
      toast.error('Please select a provider and model');
      return;
    }

    const effectivePrompt = prompt.trim() || buildDefaultPrompt(agentContext);

    // Close the config dialog — generation runs in background
    setShowConfig(false);
    cancelledRef.current = false;

    toast.info(`Generating ${count} items...`);

    try {
      const result = (await generateItems.mutateAsync({
        datasetId,
        modelId,
        prompt: effectivePrompt,
        count,
        agentContext,
      })) as { items: GeneratedItem[] };

      if (cancelledRef.current) return;

      const items = result.items ?? [];
      if (items.length === 0) {
        toast.error('No items were generated. Try a different prompt.');
        onDismiss();
        return;
      }

      setGeneratedItems(items);
      setSelectedIndices(new Set(items.map((_: unknown, i: number) => i)));
      setExpandedIndices(new Set([0]));
      // Auto-open review dialog
      setShowReview(true);
    } catch (error) {
      if (cancelledRef.current) return;
      toast.error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onDismiss();
    }
  }, [prompt, count, modelId, datasetId, generateItems, agentContext, onDismiss]);

  const handleAddSelected = useCallback(async () => {
    const items = generatedItems
      .filter((_, i) => selectedIndices.has(i))
      .map(item => ({
        input: item.input,
        groundTruth: item.groundTruth,
        source: { type: 'llm' as const, referenceId: modelId },
      }));

    if (items.length === 0) {
      toast.error('No items selected');
      return;
    }

    try {
      await batchInsertItems.mutateAsync({
        datasetId,
        items,
      });
      toast.success(`Added ${items.length} item${items.length > 1 ? 's' : ''} to dataset`);
      onDismiss();
    } catch (error) {
      toast.error(`Failed to add items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [generatedItems, selectedIndices, modelId, datasetId, batchInsertItems, onDismiss]);

  const handleConfigClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setShowConfig(false);
        onDismiss();
      }
    },
    [onDismiss],
  );

  const handleReviewClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setShowReview(false);
        onDismiss();
      }
    },
    [onDismiss],
  );

  const toggleIndex = useCallback((index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((index: number) => {
    setExpandedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIndices.size === generatedItems.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(generatedItems.map((_, i) => i)));
    }
  }, [selectedIndices.size, generatedItems.length]);

  const handleRemoveItem = useCallback((index: number) => {
    setGeneratedItems(prev => prev.filter((_, i) => i !== index));
    setSelectedIndices(prev => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
    setExpandedIndices(prev => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  }, []);

  return (
    <>
      {/* Config phase dialog */}
      <Dialog open={showConfig} onOpenChange={handleConfigClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Test Data</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Model</Label>
                <div className="flex items-center gap-1.5">
                  <div className="w-[160px]">
                    <LLMProviders
                      value={localProvider}
                      onValueChange={value => {
                        const cleaned = cleanProviderId(value);
                        setLocalProvider(cleaned);
                        setLocalModel('');
                      }}
                      size="sm"
                    />
                  </div>
                  <div className="flex-1">
                    <LLMModels
                      llmId={localProvider}
                      value={localModel}
                      onValueChange={setLocalModel}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Instructions (optional)</Label>
                <Textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g., Generate diverse recipe queries covering different cuisines, dietary restrictions, and skill levels..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Number of items</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={e => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                />
              </div>

              {!modelId && (
                <Txt variant="ui-xs" className="text-amber-400">
                  Select a provider and model above to generate items.
                </Txt>
              )}
            </div>
          </DialogBody>
          <DialogFooter className="px-6">
            <div className="flex justify-end gap-2">
              <Button onClick={() => handleConfigClose(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleGenerate} disabled={!modelId}>
                <Icon>
                  <Sparkles />
                </Icon>
                Generate
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review phase dialog — auto-opens when generation completes */}
      <Dialog open={showReview} onOpenChange={handleReviewClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Generated Items</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[70vh] flex flex-col">
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIndices.size === generatedItems.length}
                    onCheckedChange={toggleAll}
                  />
                  <Txt variant="ui-sm" className="text-neutral4">
                    {selectedIndices.size} of {generatedItems.length} selected
                  </Txt>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReview(false);
                    setGeneratedItems([]);
                    setSelectedIndices(new Set());
                    setExpandedIndices(new Set());
                    setPrompt(buildDefaultPrompt(agentContext));
                    setShowConfig(true);
                  }}
                >
                  Start over
                </Button>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2">
                  {generatedItems.map((item, index) => (
                    <div key={index} className="border border-border1 rounded-lg">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Checkbox
                          checked={selectedIndices.has(index)}
                          onCheckedChange={() => toggleIndex(index)}
                        />
                        <button type="button" className="flex-1 text-left" onClick={() => toggleExpanded(index)}>
                          <Txt variant="ui-sm" className="text-neutral5 truncate">
                            Item {index + 1}: {formatItemPreview(item.input)}
                          </Txt>
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                          <Icon size="sm">
                            <Trash2 />
                          </Icon>
                        </Button>
                      </div>

                      {expandedIndices.has(index) && (
                        <div className="border-t border-border1 px-3 py-2 space-y-2">
                          <div>
                            <Txt variant="ui-xs" className="text-neutral3 font-medium">
                              Input
                            </Txt>
                            <pre className="text-xs text-neutral5 bg-surface1 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto mt-1">
                              {JSON.stringify(item.input, null, 2)}
                            </pre>
                          </div>
                          {item.groundTruth !== undefined && (
                            <div>
                              <Txt variant="ui-xs" className="text-neutral3 font-medium">
                                Ground Truth
                              </Txt>
                              <pre className="text-xs text-neutral5 bg-surface1 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto mt-1">
                                {JSON.stringify(item.groundTruth, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogBody>
          <DialogFooter className="px-6">
            <div className="flex justify-end gap-2">
              <Button onClick={() => handleReviewClose(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleAddSelected}
                disabled={selectedIndices.size === 0 || batchInsertItems.isPending}
              >
                {batchInsertItems.isPending ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Icon>
                      <Plus />
                    </Icon>
                    Add {selectedIndices.size} Item{selectedIndices.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatItemPreview(input: unknown): string {
  if (typeof input === 'string') return input.slice(0, 80);
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    const first = Object.values(obj)[0];
    if (typeof first === 'string') return first.slice(0, 80);
    return JSON.stringify(input).slice(0, 80);
  }
  return String(input).slice(0, 80);
}
