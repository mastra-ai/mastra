import type {
  CreateTraceSignalDefinitionInput,
  TraceSignalArtifact,
  TraceSignalDefinition,
  UpdateTraceSignalDefinitionInput,
} from '@mastra/client-js';
import { useId, useState } from 'react';

import { Button } from '@/ds/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { FieldBlock, TextFieldBlock } from '@/ds/components/FormFieldBlocks';
import { Spinner } from '@/ds/components/Spinner';
import { Textarea } from '@/ds/components/Textarea';

const allTraceSignalArtifacts: TraceSignalArtifact[] = [
  'latestUserInput',
  'minifiedTrace',
  'summary',
  'tags',
  'entityIntent',
  'entityIntentSummary',
];
const reservedNames = new Set([
  'goal',
  'sentiment',
  'behavior',
  'outcome',
  'intent',
  'summary',
  'tags',
  'theme',
  'noise',
]);

export interface SignalDefinitionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition?: TraceSignalDefinition;
  error?: string;
  pending: boolean;
  onCreate: (input: CreateTraceSignalDefinitionInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateTraceSignalDefinitionInput) => Promise<void>;
}

type FormValue = CreateTraceSignalDefinitionInput;

function initialValue(definition?: TraceSignalDefinition): FormValue {
  return definition
    ? {
        name: definition.name,
        displayLabel: definition.displayLabel,
        description: definition.description,
        taskPrompt: definition.taskPrompt,
        extraOutputRules: definition.extraOutputRules,
        artifactAllowlist: allTraceSignalArtifacts,
      }
    : {
        name: '',
        displayLabel: '',
        description: '',
        taskPrompt: '',
        extraOutputRules: [],
        artifactAllowlist: allTraceSignalArtifacts,
      };
}

function validate(value: FormValue, editing: boolean): string | undefined {
  if (!editing && (!/^[a-z][a-z0-9_-]{1,31}$/.test(value.name) || reservedNames.has(value.name))) {
    return 'Use an unreserved lowercase slug of 2–32 letters, numbers, underscores, or hyphens.';
  }
  if (!value.displayLabel.trim()) return 'Display label is required.';
  if (!value.taskPrompt.trim() || value.taskPrompt.length > 2000) {
    return 'Signal instructions are required and must be at most 2,000 characters.';
  }
  return undefined;
}

export function SignalDefinitionFormDialog({
  open,
  onOpenChange,
  definition,
  error,
  pending,
  onCreate,
  onUpdate,
}: SignalDefinitionFormDialogProps) {
  const formId = useId();
  const [value, setValue] = useState(() => initialValue(definition));
  const [validationError, setValidationError] = useState<string>();
  const editing = Boolean(definition);

  const setField = <Key extends keyof FormValue>(key: Key, fieldValue: FormValue[Key]) =>
    setValue(current => ({ ...current, [key]: fieldValue }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit custom signal' : 'Create custom signal'}</DialogTitle>
          <DialogDescription>
            Definitions belong to the organization. Every signal receives all available bounded trace context.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            id={formId}
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              const invalid = validate(value, editing);
              setValidationError(invalid);
              if (invalid) return;
              const action = definition
                ? onUpdate(definition.id, {
                    displayLabel: value.displayLabel,
                    description: value.description,
                    taskPrompt: value.taskPrompt,
                    extraOutputRules: value.extraOutputRules,
                    artifactAllowlist: value.artifactAllowlist,
                  })
                : onCreate(value);
              void action.then(() => onOpenChange(false)).catch(() => undefined);
            }}
          >
            <TextFieldBlock
              id="input-name"
              name="name"
              label="Signal name"
              helpText="A stable lowercase slug. It cannot be changed after creation."
              placeholder="handoff_quality"
              value={value.name}
              disabled={editing || pending}
              onChange={event => setField('name', event.target.value)}
            />
            <TextFieldBlock
              id="input-displayLabel"
              name="displayLabel"
              label="Display label"
              placeholder="Handoff quality"
              value={value.displayLabel}
              disabled={pending}
              onChange={event => setField('displayLabel', event.target.value)}
            />
            <FieldBlock.Layout>
              <FieldBlock.Column>
                <FieldBlock.Label name="description">Description</FieldBlock.Label>
                <Textarea
                  id="input-description"
                  rows={2}
                  value={value.description}
                  disabled={pending}
                  onChange={event => setField('description', event.target.value)}
                />
              </FieldBlock.Column>
              <FieldBlock.Column>
                <FieldBlock.Label name="taskPrompt">Signal instructions</FieldBlock.Label>
                <Textarea
                  id="input-taskPrompt"
                  rows={5}
                  value={value.taskPrompt}
                  disabled={pending}
                  placeholder="Describe what this signal should evaluate and how the result should be written."
                  onChange={event => setField('taskPrompt', event.target.value)}
                />
                <FieldBlock.HelpText>
                  Tell the model what to evaluate and what the signal result should contain. {value.taskPrompt.length}
                  /2,000 characters
                </FieldBlock.HelpText>
              </FieldBlock.Column>
            </FieldBlock.Layout>
            {editing ? (
              <p className="text-ui-xs text-neutral3">
                Instruction changes create a new version and apply only to new traces. Existing analysis is unchanged.
              </p>
            ) : null}
            {validationError ? (
              <div role="alert">
                <FieldBlock.ErrorMsg>{validationError}</FieldBlock.ErrorMsg>
              </div>
            ) : null}
            {error ? (
              <div role="alert">
                <FieldBlock.ErrorMsg>{error}</FieldBlock.ErrorMsg>
              </div>
            ) : null}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={pending}>
            {pending ? <Spinner className="size-4" /> : null}
            {editing ? 'Save signal' : 'Create signal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
