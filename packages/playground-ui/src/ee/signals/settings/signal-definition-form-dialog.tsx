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
    return 'Task prompt is required and must be at most 2,000 characters.';
  }
  if (value.extraOutputRules.length > 5 || value.extraOutputRules.some(rule => rule.length > 200)) {
    return 'Use at most five additional rules of up to 200 characters each.';
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
  const [extraOutputRules, setExtraOutputRules] = useState(() => initialValue(definition).extraOutputRules.join('\n'));
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
              const normalizedValue = {
                ...value,
                extraOutputRules: extraOutputRules
                  .split('\n')
                  .map(rule => rule.trim())
                  .filter(Boolean),
              };
              const invalid = validate(normalizedValue, editing);
              setValidationError(invalid);
              if (invalid) return;
              const action = definition
                ? onUpdate(definition.id, {
                    displayLabel: normalizedValue.displayLabel,
                    description: normalizedValue.description,
                    taskPrompt: normalizedValue.taskPrompt,
                    extraOutputRules: normalizedValue.extraOutputRules,
                    artifactAllowlist: normalizedValue.artifactAllowlist,
                  })
                : onCreate(normalizedValue);
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
                <FieldBlock.Label name="taskPrompt">Task prompt</FieldBlock.Label>
                <Textarea
                  id="input-taskPrompt"
                  rows={5}
                  value={value.taskPrompt}
                  disabled={pending}
                  placeholder="Describe the quality of any handoff in one sentence."
                  onChange={event => setField('taskPrompt', event.target.value)}
                />
                <FieldBlock.HelpText>{value.taskPrompt.length}/2,000 characters</FieldBlock.HelpText>
              </FieldBlock.Column>
              <FieldBlock.Column>
                <FieldBlock.Label name="extraOutputRules">Additional response rules</FieldBlock.Label>
                <Textarea
                  id="input-extraOutputRules"
                  rows={3}
                  value={extraOutputRules}
                  disabled={pending}
                  placeholder="One optional rule per line"
                  onChange={event => setExtraOutputRules(event.target.value)}
                />
                <FieldBlock.HelpText>
                  Optional constraints on how the signal is written. The platform always requires one plain sentence.
                </FieldBlock.HelpText>
              </FieldBlock.Column>
            </FieldBlock.Layout>
            {editing ? (
              <p className="text-ui-xs text-neutral3">
                Prompt or response-rule changes create a new version and apply only to new traces. Existing analysis is
                unchanged.
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
