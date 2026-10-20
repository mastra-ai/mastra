import type { AddDatasetItemParams } from '@mastra/client-js';
import { useDataset, useDatasetMutations, useDatasets } from '@mastra/react/hooks/datasets';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CreateDatasetDialogRenderProps } from '../save-as-dataset-item-dialog';
import { buildAddItemPayload } from './build-add-item-payload';
import type { AddItemDraft, AddItemError, AddItemField } from './build-add-item-payload';
import { CollapsibleSettingsRow } from './collapsible-settings-row';
import { DatasetFieldErrors } from './dataset-field-errors';
import { DatasetPicker } from './dataset-picker';
import { parseFieldErrors } from './field-errors';
import type { FieldErrors } from './field-errors';
import { TrajectoryEditor } from './trajectory-editor';
import { toTrajectoryStepRow } from './trajectory-types';
import type { TrajectoryExpectation } from './trajectory-types';
import { useTargetAgentTools } from './use-target-agent-tools';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
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
} from '@/ds/components/Dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ds/components/Field';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { SettingsContainer } from '@/ds/new/settings';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/toast';

export interface AddDatasetItemDialogProps {
  /** The dataset to add the item to. Without it, the dialog asks which dataset. */
  datasetId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Raw JSON prefilled in the input editor. */
  initialInput?: string;
  /** Raw JSON prefilled in the ground truth editor. */
  initialGroundTruth?: string;
  /** Raw JSON array prefilled in the tool mocks editor. */
  initialToolMocks?: string;
  /** Steps prefilled in the trajectory editor; switches the expected trajectory on. */
  initialTrajectory?: TrajectoryExpectation;
  /** While true, the form waits instead of opening with values that are about to change. */
  initialValuesLoading?: boolean;
  /** Where the item comes from; sent as is. */
  source?: AddDatasetItemParams['source'];
  /** Renders a create-dataset dialog, offered first in the dataset picker. The created dataset gets picked. */
  renderCreateDatasetDialog?: (props: CreateDatasetDialogRenderProps) => ReactNode;
}

type InitialValues = Pick<
  AddDatasetItemDialogProps,
  'initialInput' | 'initialGroundTruth' | 'initialToolMocks' | 'initialTrajectory'
>;

const initialDraft = ({
  initialInput,
  initialGroundTruth,
  initialToolMocks,
  initialTrajectory,
}: InitialValues): AddItemDraft => {
  const steps = initialTrajectory?.steps ?? [];
  return {
    input: initialInput ?? '{}',
    groundTruth: initialGroundTruth ?? '',
    toolMocks: initialToolMocks ?? '',
    requestContextEnabled: false,
    requestContext: '',
    trajectoryEnabled: steps.length > 0,
    ordering: initialTrajectory?.ordering ?? 'relaxed',
    trajectorySteps: steps.map(toTrajectoryStepRow),
  };
};

const TOOL_MOCKS_PLACEHOLDER = `[
  { "toolName": "getWeather", "args": { "city": "Paris" }, "output": { "temp": 18 } },
  { "toolName": "getForecast", "args": {}, "output": { "days": 5 }, "matchArgs": "ignore" }
]`;

/** The keys of the dataset's request context schema, as a JSON object to fill in. */
const requestContextPlaceholder = (schema: unknown) => {
  const properties = typeof schema === 'object' && schema !== null && 'properties' in schema ? schema.properties : {};
  const keys = typeof properties === 'object' && properties !== null ? Object.keys(properties) : [];
  if (keys.length === 0) return '{ "tenantId": "acme" }';
  return JSON.stringify(Object.fromEntries(keys.map(key => [key, ''])), null, 2);
};

type WizardStep = 1 | 2 | 3;

/** Only steps whose fields don't describe themselves carry a description. */
const STEPS: Record<WizardStep, { title: string; description?: ReactNode; optional?: boolean }> = {
  1: { title: 'Input and ground truth' },
  2: {
    title: 'Tool mocks',
    optional: true,
    description:
      'Return fixed results instead of running the real tools. When the target calls a tool listed here with the same args, it gets your output back. Leave empty to run tools for real.',
  },
  3: {
    title: 'Context and trajectory',
    optional: true,
    description:
      'Pass values to the run, or check the steps the target takes. Leave both off to add the item without them.',
  },
};

const GROUND_TRUTH_PLACEHOLDER = '{ "text": "The answer you expect" }';

/** Copying an editor that holds nothing worth copying is noise. */
const hasContent = (value: string) => !['', '{}'].includes(value.trim());

const STEP_COUNT = Object.keys(STEPS).length;

const STEP_OF_FIELD: Record<AddItemField, WizardStep> = {
  input: 1,
  groundTruth: 1,
  toolMocks: 2,
  requestContext: 3,
  expectedTrajectory: 3,
};

const isAddItemField = (field: string): field is AddItemField => field in STEP_OF_FIELD;

const stepTransition = 'animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none';

/**
 * Add an item to a dataset in three steps: the input and its expected answer, tool mocks, then the request
 * context and expected trajectory. Only the first step is required; the others can be left empty.
 */
export function AddDatasetItemDialog({
  open,
  onOpenChange,
  initialValuesLoading,
  ...props
}: AddDatasetItemDialogProps) {
  const { addItem } = useDatasetMutations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={addItem.isPending}>
      <DialogContent size="xl">
        {/* The form mounts once its initial values are known, and unmounts on close, so every open starts fresh. */}
        {initialValuesLoading ? (
          <LoadingForm />
        ) : (
          <AddDatasetItemForm {...props} addItem={addItem} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WizardHeader({ step }: { step: WizardStep }) {
  const { title, description, optional } = STEPS[step];

  return (
    <DialogHeader key={step} className={stepTransition}>
      <div className="flex min-w-0 items-center gap-2">
        <DialogTitle>{title}</DialogTitle>
        {optional && <Badge size="sm">Optional</Badge>}
      </div>
      {description && <DialogDescription>{description}</DialogDescription>}
    </DialogHeader>
  );
}

function StepProgress({ step }: { step: WizardStep }) {
  return (
    <div className="mr-auto flex items-center gap-2">
      <ol className="flex gap-1" aria-label={`Step ${step} of ${STEP_COUNT}`}>
        {Object.keys(STEPS).map((key, index) => (
          <li
            key={key}
            aria-current={index + 1 === step ? 'step' : undefined}
            className={cn('h-1 w-6 rounded-full transition-colors', index < step ? 'bg-success-indicator' : 'bg-fill')}
          />
        ))}
      </ol>
      <Txt as="span" variant="caption" tone="muted" aria-hidden="true">
        Step {step} of {STEP_COUNT}
      </Txt>
    </div>
  );
}

function LoadingForm() {
  return (
    <>
      <WizardHeader step={1} />
      <DialogBody aria-busy>
        <div className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[220px]" />
        </div>
      </DialogBody>
      <DialogFooter>
        <StepProgress step={1} />
        <DialogCancel>Cancel</DialogCancel>
        <DialogAction type="submit" disabled>
          Next
        </DialogAction>
      </DialogFooter>
    </>
  );
}

type AddDatasetItemFormProps = Omit<AddDatasetItemDialogProps, 'open' | 'initialValuesLoading'> & {
  addItem: ReturnType<typeof useDatasetMutations>['addItem'];
};

function AddDatasetItemForm({
  datasetId,
  onOpenChange,
  onSuccess,
  source,
  renderCreateDatasetDialog,
  addItem,
  ...initialValues
}: AddDatasetItemFormProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState(() => initialDraft(initialValues));
  const [formError, setFormError] = useState<AddItemError>();
  const [apiErrors, setApiErrors] = useState<FieldErrors>();
  const [pickedDatasetId, setPickedDatasetId] = useState('');
  const [isCreateDatasetOpen, setIsCreateDatasetOpen] = useState(false);

  const targetDatasetId = datasetId ?? pickedDatasetId;
  const { data: targetDataset } = useDataset({
    datasetId: targetDatasetId,
    queryOptions: { enabled: Boolean(targetDatasetId) },
  });
  const { toolNames } = useTargetAgentTools(targetDatasetId, { enabled: true });
  const { data: datasetList, isLoading: isDatasetsLoading } = useDatasets({ queryOptions: { enabled: !datasetId } });
  const { navigate, paths } = useLinkComponent();

  const datasets = datasetList?.datasets ?? [];
  const pickedDataset = datasets.find(dataset => dataset.id === pickedDatasetId);
  // Picking needs the dataset listed: a just-created one is picked before the refetch returns it.
  const hasDataset = datasetId !== undefined || pickedDataset !== undefined;

  const update = (patch: (current: AddItemDraft) => Partial<AddItemDraft>) => {
    setDraft(current => ({ ...current, ...patch(current) }));
    setFormError(undefined);
  };

  const showError = (error: AddItemError) => {
    setFormError(error);
    setStep(STEP_OF_FIELD[error.field]);
  };

  /** Checks what was entered so far, then moves on; the trajectory is checked once reached. */
  const advance = () => {
    const checked = buildAddItemPayload({ ...draft, trajectoryEnabled: false });
    if ('error' in checked) return showError(checked.error);
    setStep(step === 1 ? 2 : 3);
  };

  const handleSubmit = async () => {
    const payload = buildAddItemPayload(draft);
    if ('error' in payload) return showError(payload.error);

    try {
      const item = await addItem.mutateAsync({
        datasetId: targetDatasetId,
        ...payload.params,
        ...(source ? { source } : {}),
      });
      if (pickedDataset) {
        // Opens the dataset with the new item's drawer; apps without that route return ''.
        const itemHref = paths.datasetItemLink(pickedDataset.id, item.id);
        toast.success(`Added to ${pickedDataset.name}`, {
          action: itemHref ? { label: 'Go to dataset', onClick: () => navigate(itemHref) } : undefined,
        });
      } else {
        toast.success('Item added successfully');
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const fieldErrors = parseFieldErrors(error);
      if (fieldErrors) {
        setApiErrors(fieldErrors);
        if (isAddItemField(fieldErrors.field)) setStep(STEP_OF_FIELD[fieldErrors.field]);
        return;
      }
      toast.error(`Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const errorOf = (field: AddItemField) => (formError?.field === field ? formError.message : undefined);
  const apiErrorsOf = (field: AddItemField) => (apiErrors?.field === field ? apiErrors.errors : []);
  const isInvalid = (field: AddItemField) => Boolean(errorOf(field)) || apiErrorsOf(field).length > 0;

  const editJson = (field: 'input' | 'groundTruth' | 'toolMocks' | 'requestContext') => (value: string) => {
    update(() => ({ [field]: value }));
    setApiErrors(undefined);
  };

  return (
    <>
      <WizardHeader step={step} />

      <DialogBody>
        {/* Every step stays mounted so what was entered survives going back and forth. */}
        <div hidden={step !== 1} className={cn('flex flex-col gap-6', stepTransition)}>
          {datasetId === undefined && (
            <DatasetPicker
              datasets={datasets}
              value={pickedDatasetId}
              onValueChange={setPickedDatasetId}
              loading={isDatasetsLoading || (Boolean(pickedDatasetId) && !pickedDataset)}
              disabled={addItem.isPending}
              onCreateDataset={renderCreateDatasetDialog ? () => setIsCreateDatasetOpen(true) : undefined}
            />
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field invalid={isInvalid('input')}>
              <FieldLabel required>Input</FieldLabel>
              <FieldDescription>What the target receives when this item runs.</FieldDescription>
              <CodeEditor
                value={draft.input}
                onChange={editJson('input')}
                aria-label="Input JSON"
                showCopyButton={hasContent(draft.input)}
                showFormatButton={hasContent(draft.input)}
                className="min-h-[220px]"
              />
              <FieldError>{errorOf('input')}</FieldError>
              <DatasetFieldErrors field="input" errors={apiErrorsOf('input')} />
            </Field>
            <Field invalid={isInvalid('groundTruth')}>
              <FieldLabel>Ground truth</FieldLabel>
              <FieldDescription>The expected answer scorers compare against.</FieldDescription>
              <CodeEditor
                value={draft.groundTruth}
                onChange={editJson('groundTruth')}
                aria-label="Ground truth JSON"
                placeholder={GROUND_TRUTH_PLACEHOLDER}
                showCopyButton={hasContent(draft.groundTruth)}
                showFormatButton={hasContent(draft.groundTruth)}
                className="min-h-[220px]"
              />
              <FieldError>{errorOf('groundTruth')}</FieldError>
              <DatasetFieldErrors field="groundTruth" errors={apiErrorsOf('groundTruth')} />
            </Field>
          </div>
        </div>

        <div hidden={step !== 2} className={stepTransition}>
          <Field invalid={isInvalid('toolMocks')}>
            <CodeEditor
              value={draft.toolMocks}
              onChange={editJson('toolMocks')}
              aria-label="Tool mocks JSON"
              placeholder={TOOL_MOCKS_PLACEHOLDER}
              showCopyButton={hasContent(draft.toolMocks)}
              showFormatButton={hasContent(draft.toolMocks)}
              className="min-h-[220px]"
            />
            <FieldError>{errorOf('toolMocks')}</FieldError>
            <DatasetFieldErrors field="toolMocks" errors={apiErrorsOf('toolMocks')} />
          </Field>
        </div>

        <div hidden={step !== 3} className={stepTransition}>
          <SettingsContainer>
            <CollapsibleSettingsRow
              label="Request context"
              description="Values passed to the target when this item runs."
              enabled={draft.requestContextEnabled}
              onEnabledChange={requestContextEnabled => update(() => ({ requestContextEnabled }))}
              errorMsg={errorOf('requestContext')}
            >
              <CodeEditor
                value={draft.requestContext}
                onChange={editJson('requestContext')}
                aria-label="Request context JSON"
                placeholder={requestContextPlaceholder(targetDataset?.requestContextSchema)}
                showCopyButton={hasContent(draft.requestContext)}
                showFormatButton={hasContent(draft.requestContext)}
                className="min-h-[120px]"
              />
            </CollapsibleSettingsRow>
            <CollapsibleSettingsRow
              label="Expected trajectory"
              description="The steps the target should take to produce its answer."
              enabled={draft.trajectoryEnabled}
              onEnabledChange={trajectoryEnabled => update(() => ({ trajectoryEnabled }))}
              errorMsg={errorOf('expectedTrajectory')}
            >
              <TrajectoryEditor
                ordering={draft.ordering}
                onOrderingChange={ordering => update(() => ({ ordering }))}
                steps={draft.trajectorySteps}
                onStepsChange={change => update(current => ({ trajectorySteps: change(current.trajectorySteps) }))}
                toolNames={toolNames}
              />
            </CollapsibleSettingsRow>
          </SettingsContainer>
        </div>
      </DialogBody>

      <DialogFooter>
        <StepProgress step={step} />
        {step === 1 ? (
          <DialogCancel>Cancel</DialogCancel>
        ) : (
          <Button
            variant="ghost"
            disabled={addItem.isPending}
            onClick={() => setStep(current => (current - 1) as WizardStep)}
          >
            Back
          </Button>
        )}
        {step < 3 ? (
          <DialogAction disabled={!hasDataset} onConfirm={advance}>
            Next
          </DialogAction>
        ) : (
          <DialogAction onConfirm={() => void handleSubmit()}>Add item</DialogAction>
        )}
      </DialogFooter>

      {/* Rendered inside the dialog so the nested dialog stays in its focus scope instead of dismissing it. */}
      {renderCreateDatasetDialog?.({
        open: isCreateDatasetOpen,
        onOpenChange: setIsCreateDatasetOpen,
        onSuccess: setPickedDatasetId,
      })}
    </>
  );
}
