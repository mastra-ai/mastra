import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui/components/Dialog';
import { Label } from '@mastra/playground-ui/components/Label';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { format } from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { ScorerSelector } from './scorer-selector';
import type { TargetType } from './target-selector';
import { TargetSelector } from './target-selector';
import { DynamicForm } from '@/lib/form';
import { resolveSerializedZodOutput } from '@/lib/form/utils';

export interface ExperimentTriggerDialogProps {
  datasetId: string;
  version?: number;
  requestContextSchema?: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (experimentId: string) => void;
}

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
      return resolveSerializedZodOutput(jsonSchemaToZod(requestContextSchema as Parameters<typeof jsonSchemaToZod>[0]));
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

export function ExperimentTriggerDialog({
  datasetId,
  version,
  requestContextSchema,
  open,
  onOpenChange,
  onSuccess,
}: ExperimentTriggerDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [targetType, setTargetType] = useState<TargetType | ''>('');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedScorers, setSelectedScorers] = useState<string[]>([]);
  const [requestContextValues, setRequestContextValues] = useState<Record<string, unknown>>({});
  const [requestContextRaw, setRequestContextRaw] = useState('');

  const { triggerExperiment } = useDatasetMutations();

  const hasSchema = Boolean(requestContextSchema && Object.keys(requestContextSchema).length > 0);

  const canRun = targetType && targetId;
  const isRunning = triggerExperiment.isPending;

  const resetState = () => {
    setTargetType('');
    setTargetId('');
    setSelectedScorers([]);
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
    if (!canRun) return;

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
        targetType,
        targetId,
        scorerIds: selectedScorers.length > 0 ? selectedScorers : undefined,
        version,
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent ref={contentRef}>
        <DialogHeader>
          <DialogTitle>Run Experiment</DialogTitle>
          <DialogDescription>
            {version
              ? `Execute items from ${format(new Date(version), 'MMM d, yyyy')} version against a target.`
              : 'Execute all items in this dataset against a target.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-6">
          <TargetSelector
            targetType={targetType}
            setTargetType={setTargetType}
            targetId={targetId}
            setTargetId={setTargetId}
            container={contentRef}
          />

          {/* Only show scorer selector for agent/workflow targets */}
          {targetType && targetType !== 'scorer' && (
            <ScorerSelector
              selectedScorers={selectedScorers}
              setSelectedScorers={setSelectedScorers}
              disabled={isRunning}
              container={contentRef}
            />
          )}

          {hasSchema ? (
            <RequestContextForm requestContextSchema={requestContextSchema!} onChange={setRequestContextValues} />
          ) : (
            <div className="space-y-2">
              <Label>Request Context (JSON, optional)</Label>
              <CodeEditor
                value={requestContextRaw}
                onChange={setRequestContextRaw}
                showCopyButton={false}
                className="min-h-[80px]"
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter className="px-6 pt-4">
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
              'Run'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
