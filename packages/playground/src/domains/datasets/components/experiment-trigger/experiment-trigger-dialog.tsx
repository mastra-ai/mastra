import { Badge } from '@mastra/playground-ui/components/Badge';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldLabel, Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useDatasetMutations, useDataset } from '@mastra/playground-ui/domains/datasets';
import { useDatasetItems } from '@mastra/playground-ui/domains/datasets/hooks/use-dataset-items';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DatasetCombobox } from '../dataset-combobox';
import { DatasetVersions } from '../dataset-versions';
import { ScorerSelector } from './scorer-selector';
import type { TargetType } from './target-selector';
import { TargetSelector } from './target-selector';

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
    return (
      <div role="alert">
        <Notice variant="destructive">Failed to parse request context schema</Notice>
      </div>
    );
  }

  return (
    <Fieldset>
      <FieldsetLegend>Request Context</FieldsetLegend>
      <DynamicForm schema={zodSchema} onValuesChange={onChange} className="[&_button[type=submit]]:hidden" />
    </Fieldset>
  );
}

function PipelineStep({
  index,
  done,
  isLast,
  children,
}: {
  index: number;
  done: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <Txt
          as="span"
          variant="meta"
          tone="muted"
          aria-hidden="true"
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border',
            done ? 'border-success-edge bg-success-subtle text-success-subtle-foreground' : 'border-border',
          )}
        >
          {index}
        </Txt>
        {!isLast && <span aria-hidden="true" className="mt-2 w-px flex-1 bg-border" />}
      </div>
      <div className={cn('min-w-0 flex-1 space-y-3', !isLast && 'pb-4')}>{children}</div>
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
  const [selectedScorers, setSelectedScorers] = useState<string[] | null>(initialScorerIds ?? null);
  const [requestContextValues, setRequestContextValues] = useState<Record<string, unknown>>({});
  const [requestContextRaw, setRequestContextRaw] = useState('');

  const { triggerExperiment } = useDatasetMutations();
  const { data: dataset } = useDataset(datasetId);
  const { total: itemCount } = useDatasetItems(datasetId, undefined, version);
  const requestContextSchema = dataset?.requestContextSchema as Record<string, unknown> | undefined;
  const datasetDefaultScorers = dataset?.scorerIds ?? [];
  const usesDatasetDefaults = selectedScorers === null && datasetDefaultScorers.length > 0;
  const effectiveScorers = selectedScorers ?? datasetDefaultScorers;

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
    setSelectedScorers(initialScorerIds ?? null);
    setRequestContextValues({});
  };

  const resetState = () => {
    setName(initialName ?? '');
    setDescription(initialDescription ?? '');
    setDatasetId(initialDatasetId ?? '');
    setVersion(initialDatasetVersion ?? null);
    setTargetType(initialTargetType ?? '');
    setTargetId(initialTargetId ?? '');
    setSelectedScorers(initialScorerIds ?? null);
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
        scorerIds: effectiveScorers.length > 0 ? effectiveScorers : undefined,
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
    onOpenChange(false);
    resetState();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canRun && !isRunning) {
      event.preventDefault();
      void handleRun();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} pending={isRunning}>
      <DialogContent ref={contentRef} size="lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Run experiment</DialogTitle>
          <DialogDescription>
            Pick a dataset, choose what to run it against, and optionally score the results.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <Field>
              <FieldLabel required>Name</FieldLabel>
              <Input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter experiment name"
                autoFocus
                disabled={isRunning}
              />
            </Field>

            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter experiment description (optional)"
                disabled={isRunning}
                rows={2}
              />
            </Field>
          </div>

          <ol className="list-none">
            <PipelineStep index={1} done={Boolean(datasetId)}>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <Field>
                  <FieldLabel>Dataset</FieldLabel>
                  <DatasetCombobox value={datasetId} onValueChange={handleDatasetChange} container={contentRef} />
                </Field>
                {datasetId && (
                  <Field>
                    <FieldLabel>Version</FieldLabel>
                    <DatasetVersions
                      datasetId={datasetId}
                      value={version}
                      onValueChange={setVersion}
                      container={contentRef}
                    />
                  </Field>
                )}
              </div>
              {datasetId && itemCount !== undefined && (
                <Txt variant="meta" tone="muted">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Txt>
              )}
            </PipelineStep>

            <PipelineStep index={2} done={Boolean(targetId)}>
              <TargetSelector
                targetType={targetType}
                setTargetType={setTargetType}
                targetId={targetId}
                setTargetId={setTargetId}
                container={contentRef}
              />
              {targetType && !targetId && (
                <Txt variant="meta" tone="muted">
                  Choose {targetType === 'agent' ? 'an' : 'a'} {targetType} to run
                </Txt>
              )}
            </PipelineStep>

            <PipelineStep index={3} done={effectiveScorers.length > 0} isLast>
              <ScorerSelector
                selectedScorers={effectiveScorers}
                setSelectedScorers={setSelectedScorers}
                disabled={isRunning}
                container={contentRef}
                helperText={
                  usesDatasetDefaults
                    ? "Pre-filled from the dataset's default scorers."
                    : 'Scores are computed after each item runs.'
                }
              />
            </PipelineStep>
          </ol>

          <Collapsible>
            <CollapsibleTrigger textVariant="caption" className="flex items-center gap-2">
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

        <DialogFooter>
          <p data-testid="experiment-run-status" aria-live="polite" className="mr-auto flex items-center gap-2">
            {missing.length === 0 ? (
              <>
                <Badge variant="success" indicator="dot">
                  Ready
                </Badge>
                <Txt as="span" variant="meta" tone="muted">
                  {itemCount ?? 0} items · {targetType} · {effectiveScorers.length} scorers
                </Txt>
              </>
            ) : (
              <Badge variant="neutral" indicator="dot">
                Missing {missing.join(', ')}
              </Badge>
            )}
          </p>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={handleRun} disabled={!canRun}>
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
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
