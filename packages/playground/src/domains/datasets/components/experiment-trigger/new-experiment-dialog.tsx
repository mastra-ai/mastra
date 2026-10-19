import { Collapsible, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { AdvancedToggle } from './advanced-toggle';
import { DatasetField } from './dataset-field';
import { DatasetVersionField } from './dataset-version-field';
import { ExperimentDescriptionField } from './experiment-description-field';
import { ExperimentNameField } from './experiment-name-field';
import type { ExperimentTriggerInitialValues } from './experiment-trigger-options';
import { RequestContextField } from './request-context-field';
import { RunExperimentAction } from './run-experiment-action';
import { ScorersField } from './scorers-field';
import { TargetField } from './target-field';
import { useDatasetChoice } from './use-dataset-choice';
import { useExperimentName } from './use-experiment-name';
import { useRequestContextInput } from './use-request-context-input';
import { useScorerChoice } from './use-scorer-choice';
import { useTargetChoice } from './use-target-choice';

export interface NewExperimentDialogProps extends ExperimentTriggerInitialValues {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
  onSuccess?: (experimentId: string) => void;
}

const isModEnter = (event: KeyboardEvent) => (event.metaKey || event.ctrlKey) && event.key === 'Enter';
const optionalText = (text: string) => text.trim() || undefined;
const optionalList = (list: string[]) => (list.length > 0 ? list : undefined);

/**
 * New experiment: pick what to run, on which data, and how to score it. Everything else has a default
 * and sits under Advanced, whose toggle shows in the footer while closed and stays in place as the
 * section's header row once opened.
 */
export function NewExperimentDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  onSuccess,
  initialDatasetId,
  initialDatasetVersion,
  initialScorerIds,
  initialTargetType,
  initialTargetId,
  initialName,
  initialDescription,
}: NewExperimentDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const targetChoice = useTargetChoice({ initialTargetType, initialTargetId });
  const datasetChoice = useDatasetChoice({ initialDatasetId, initialDatasetVersion });
  const scorerChoice = useScorerChoice({ datasetId: datasetChoice.datasetId, initialScorerIds });
  const requestContextInput = useRequestContextInput(datasetChoice.datasetId);
  const experimentName = useExperimentName({ initialName, targetLabel: targetChoice.target?.label });
  const [description, setDescription] = useState(initialDescription ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { triggerExperiment } = useDatasetMutations();

  const { target } = targetChoice;
  const { datasetId } = datasetChoice;
  const isRunning = triggerExperiment.isPending;
  // The schema form converts its schema once per mount, so it remounts for each dataset; the JSON editor stays.
  const requestContextKey = requestContextInput.schema ? datasetId : undefined;
  // Wait for the targets to load, so a rerun is named after the display name, not the raw id.
  const canRun = Boolean(datasetId && target) && !targetChoice.isLoading && !isRunning;

  const handleDatasetChange = (nextDatasetId: string) => {
    datasetChoice.selectDataset(nextDatasetId);
    scorerChoice.resetScorers();
    requestContextInput.resetValues();
  };

  const run = async () => {
    if (!canRun || !target) return;

    const requestContext = requestContextInput.resolve();
    if (!requestContext.ok) {
      toast.error(requestContext.message);
      return;
    }

    try {
      const result = await triggerExperiment.mutateAsync({
        datasetId,
        name: experimentName.runName,
        description: optionalText(description),
        targetType: target.type,
        targetId: target.id,
        scorerIds: optionalList(scorerChoice.scorerIds),
        version: datasetChoice.version,
        requestContext: requestContext.requestContext,
      });
      toast.success('Experiment started');
      onOpenChange(false);
      onSuccess?.(result.experimentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start experiment');
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isModEnter(event) || !canRun) return;
    event.preventDefault();
    void run();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete} pending={isRunning}>
      <DialogContent ref={contentRef} size="md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>New experiment</DialogTitle>
          <DialogDescription>Run every item in a dataset through an agent, workflow or scorer.</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* A plain block, so the closed Advanced panel adds no gap below the toggle. */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="space-y-5">
              <TargetField
                options={targetChoice.options}
                isLoading={targetChoice.isLoading}
                target={target}
                onTargetValueChange={targetChoice.setTargetValue}
                container={contentRef}
              />
              <DatasetField
                datasets={datasetChoice.datasets}
                datasetId={datasetId}
                version={datasetChoice.version}
                onDatasetChange={handleDatasetChange}
                container={contentRef}
              />
              <ScorersField
                scorerIds={scorerChoice.scorerIds}
                usesDefaultScorers={scorerChoice.usesDefaultScorers}
                onScorerIdsChange={scorerChoice.setScorerIds}
                container={contentRef}
              />
            </div>

            <div className="mt-4">
              <AdvancedToggle />
            </div>

            <CollapsibleContent className="space-y-4 pt-3">
              {datasetId && (
                <DatasetVersionField
                  datasetId={datasetId}
                  version={datasetChoice.version}
                  onVersionChange={datasetChoice.setVersion}
                  container={contentRef}
                />
              )}
              <ExperimentNameField
                name={experimentName.name}
                defaultName={experimentName.defaultName}
                onNameChange={experimentName.setName}
                disabled={isRunning}
              />
              <ExperimentDescriptionField
                description={description}
                onDescriptionChange={setDescription}
                disabled={isRunning}
              />
              <RequestContextField
                key={requestContextKey}
                schema={requestContextInput.schema}
                raw={requestContextInput.raw}
                onRawChange={requestContextInput.setRaw}
                onValuesChange={requestContextInput.setValues}
              />
            </CollapsibleContent>
          </Collapsible>
        </DialogBody>

        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <RunExperimentAction onRun={run} canRun={canRun} isRunning={isRunning} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
