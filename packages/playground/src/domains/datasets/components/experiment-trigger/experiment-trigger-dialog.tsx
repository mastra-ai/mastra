import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Label } from '@mastra/playground-ui/components/Label';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDatasetItems } from '../../hooks/use-dataset-items';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { useDataset } from '../../hooks/use-datasets';
import { DatasetCombobox } from '../dataset-combobox';
import { DatasetVersions } from '../dataset-versions';
import { ScorerSelector } from './scorer-selector';
import type { TargetType } from './target-selector';
import { TargetSelector } from './target-selector';
import { DynamicForm } from '@/lib/form';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

export interface ExperimentTriggerDialogProps {
  initialDatasetId?: string;
  initialDatasetVersion?: number;
  initialScorerIds?: string[];
  initialTargetType?: TargetType;
  initialTargetId?: string;
  initialName?: string;
  initialDescription?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (experimentId: string) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Schema-driven request context form. Converts the dataset's plain JSON Schema
 * into a zod schema and surfaces values via onChange (no global store coupling).
 */
function RequestContextForm({
  requestContextSchema,
  onChange,
}: {
  requestContextSchema: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const zodSchema = useMemo(() => {
    try {
      return jsonSchemaToZodRuntime(requestContextSchema as Parameters<typeof jsonSchemaToZodRuntime>[0]);
    } catch (error) {
      console.error('Failed to parse requestContextSchema:', error);
      return null;
    }
  }, [requestContextSchema]);

  if (!zodSchema) {
    return <p className="text-destructive text-sm">Failed to parse request context schema</p>;
  }

  return (
    <div className="space-y-2">
      <Label>Request Context</Label>
      <DynamicForm schema={zodSchema} onValuesChange={onChange} className="[&_button[type=submit]]:hidden" />
    </div>
  );
}

function PipelineStep({
  index,
  title,
  done,
  isLast,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border text-ui-xs font-medium',
            done ? 'border-accent1 bg-accent1 text-white' : 'border-border1 text-neutral3',
          )}
        >
          {index}
        </span>
        {!isLast && <span aria-hidden="true" className="bg-border1 mt-2 w-px flex-1" />}
      </div>
      <div className={cn('min-w-0 flex-1 space-y-3', !isLast && 'pb-6')}>
        <p className="text-ui-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

export function ExperimentTriggerDialog({
  initialDatasetId,
  initialDatasetVersion,
  initialScorerIds,
  initialTargetType,
  initialTargetId,
  initialName,
  initialDescription,
  open,
  onOpenChange,
  onSuccess,
}: ExperimentTriggerDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [datasetId, setDatasetId] = useState(initialDatasetId ?? '');
  const [version, setVersion] = useState<number | null>(initialDatasetVersion ?? null);
  const [targetType, setTargetType] = useState<TargetType | ''>(initialTargetType ?? '');
  const [targetId, setTargetId] = useState<string>(initialTargetId ?? '');
  const [selectedScorers, setSelectedScorers] = useState<string[]>(initialScorerIds ?? []);
  const [requestContextValues, setRequestContextValues] = useState<Record<string, unknown>>({});
  const [requestContextRaw, setRequestContextRaw] = useState('');

  const { triggerExperiment } = useDatasetMutations();
  const { data: dataset } = useDataset(datasetId);
  const { total: itemCount } = useDatasetItems(datasetId, undefined, version);
  const requestContextSchema = dataset?.requestContextSchema as Record<string, unknown> | undefined;

  const hasSchema = Boolean(requestContextSchema && Object.keys(requestContextSchema).length > 0);

  const canRun = Boolean(datasetId && targetType && targetId && name.trim());
  const isRunning = triggerExperiment.isPending;

  const missing = [!name.trim() && 'name', !datasetId && 'dataset', !targetId && 'target'].filter(Boolean);
  const hasRequestContext = hasSchema
    ? Object.values(requestContextValues).some(v => v !== undefined && v !== '')
    : requestContextRaw.trim().length > 0;

  const handleDatasetChange = (nextDatasetId: string) => {
    setDatasetId(nextDatasetId);
    setVersion(null);
    setRequestContextValues({});
  };

  const resetState = () => {
    setName(initialName ?? '');
    setDescription(initialDescription ?? '');
    setDatasetId(initialDatasetId ?? '');
    setVersion(initialDatasetVersion ?? null);
    setTargetType(initialTargetType ?? '');
    setTargetId(initialTargetId ?? '');
    setSelectedScorers(initialScorerIds ?? []);
    setRequestContextValues({});
    setRequestContextRaw('');
  };

  const resolveRequestContext = (): Record<string, unknown> | undefined => {
    if (hasSchema) {
      const entries = Object.entries(requestContextValues).filter(([, v]) => v !== undefined && v !== '');
      return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    }
    if (requestContextRaw.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(requestContextRaw);
      } catch {
        throw new Error('Request Context must be valid JSON');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Request Context must be a JSON object');
      }
      return parsed as Record<string, unknown>;
    }
    return undefined;
  };

  const handleRun = async () => {
    // Explicit guards (rather than `canRun`) so TypeScript narrows `targetType` for the request.
    if (!datasetId || !targetType || !targetId || !name.trim()) return;

    let requestContext: Record<string, unknown> | undefined;
    try {
      requestContext = resolveRequestContext();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request Context must be valid JSON';
      toast.error(message);
      return;
    }

    try {
      const result = await triggerExperiment.mutateAsync({
        datasetId,
        name: name.trim(),
        description: description.trim() || undefined,
        targetType,
        targetId,
        scorerIds: selectedScorers.length > 0 ? selectedScorers : undefined,
        version: version ?? undefined,
        requestContext,
      });

      toast.success('Experiment triggered successfully');
      onOpenChange(false);
      onSuccess?.(result.experimentId);

      resetState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trigger experiment';
      toast.error(message);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      onOpenChange(false);
      resetState();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canRun && !isRunning) {
      event.preventDefault();
      void handleRun();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        ref={contentRef}
        className="w-[640px] max-w-[calc(100vw-2rem)] gap-0 p-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="border-border1 border-b px-6 py-4">
          <DialogTitle>Run experiment</DialogTitle>
          <DialogDescription className="text-ui-sm text-neutral3 not-sr-only">
            Pick a dataset, choose what to run it against, and optionally score the results.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="experiment-name">Name *</Label>
              <Input
                id="experiment-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter experiment name"
                autoFocus
                disabled={isRunning}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="experiment-description">Description</Label>
              <Textarea
                id="experiment-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter experiment description (optional)"
                disabled={isRunning}
                rows={2}
              />
            </div>
          </div>

          <ol className="list-none">
            <PipelineStep index={1} title="Dataset" done={Boolean(datasetId)}>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <DatasetCombobox value={datasetId} onValueChange={handleDatasetChange} container={contentRef} />
                {datasetId && (
                  <DatasetVersions
                    datasetId={datasetId}
                    value={version}
                    onValueChange={setVersion}
                    container={contentRef}
                  />
                )}
              </div>
              {datasetId && itemCount !== undefined && (
                <p className="text-ui-xs text-neutral3">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>
              )}
            </PipelineStep>

            <PipelineStep index={2} title="Target" done={Boolean(targetId)}>
              <TargetSelector
                targetType={targetType}
                setTargetType={setTargetType}
                targetId={targetId}
                setTargetId={setTargetId}
                container={contentRef}
              />
              {targetType && !targetId && (
                <p className="text-ui-xs text-neutral3">
                  Choose {targetType === 'agent' ? 'an' : 'a'} {targetType} to run
                </p>
              )}
            </PipelineStep>

            <PipelineStep index={3} title="Scorers (Optional)" done={selectedScorers.length > 0} isLast>
              <ScorerSelector
                label=""
                selectedScorers={selectedScorers}
                setSelectedScorers={setSelectedScorers}
                disabled={isRunning}
                container={contentRef}
                helperText="Scores are computed after each item runs."
              />
            </PipelineStep>
          </ol>

          <Collapsible>
            <CollapsibleTrigger className="text-ui-sm flex items-center gap-2">
              <ChevronRight className="size-4" />
              Request Context (JSON, optional)
              {hasRequestContext && (
                <Badge size="xs" variant="blue">
                  set
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              {hasSchema ? (
                <RequestContextForm requestContextSchema={requestContextSchema!} onChange={setRequestContextValues} />
              ) : (
                <CodeEditor
                  value={requestContextRaw}
                  onChange={setRequestContextRaw}
                  showCopyButton={false}
                  aria-label="Request context JSON"
                  className="min-h-[160px]"
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        </DialogBody>

        <DialogFooter className="border-border1 items-center border-t px-6 py-4 sm:justify-between">
          <p data-testid="experiment-run-status" aria-live="polite" className="flex items-center gap-2">
            {missing.length === 0 ? (
              <>
                <Badge variant="green" indicator="dot">
                  Ready
                </Badge>
                <span className="text-ui-xs text-neutral3">
                  {itemCount ?? 0} items · {targetType} · {selectedScorers.length} scorers
                </span>
              </>
            ) : (
              <Badge variant="neutral" indicator="dot">
                Missing {missing.join(', ')}
              </Badge>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={handleClose} disabled={isRunning}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRun} disabled={!canRun || isRunning}>
              {isRunning ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Running...
                </>
              ) : (
                <>
                  Run
                  <span className="ml-1 inline-flex gap-0.5" aria-hidden="true">
                    <Kbd size="xs">{isMac ? '⌘' : 'Ctrl'}</Kbd>
                    <Kbd size="xs">↵</Kbd>
                  </span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
