import type {
  CreateTraceSignalDefinitionInput,
  TraceSignalDefinition,
  UpdateTraceSignalDefinitionInput,
} from '@mastra/client-js';
import { useId, useState } from 'react';

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
import { Form } from '@/ds/components/Form';
import { Input } from '@/ds/components/Input';
import { Notice } from '@/ds/components/Notice';
import { Textarea } from '@/ds/components/Textarea';
import { Txt } from '@/ds/components/Txt';

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
type FormErrors = Partial<Record<keyof FormValue, string>>;

function initialValue(definition?: TraceSignalDefinition): FormValue {
  return definition
    ? {
        name: definition.name,
        displayLabel: definition.displayLabel,
        description: definition.description,
        taskPrompt: definition.taskPrompt,
      }
    : {
        name: '',
        displayLabel: '',
        description: '',
        taskPrompt: '',
      };
}

function validate(value: FormValue, editing: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!editing && (!/^[a-z][a-z0-9_-]{1,31}$/.test(value.name) || reservedNames.has(value.name))) {
    errors.name = 'Use an unreserved lowercase slug of 2–32 letters, numbers, underscores, or hyphens.';
  }
  if (!value.displayLabel.trim()) errors.displayLabel = 'Display label is required.';
  if (!value.taskPrompt.trim() || value.taskPrompt.length > 2000) {
    errors.taskPrompt = 'Signal instructions are required and must be at most 2,000 characters.';
  }
  return errors;
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
  const [validationErrors, setValidationErrors] = useState<FormErrors>({});
  const editing = Boolean(definition);

  const setField = <Key extends keyof FormValue>(key: Key, fieldValue: FormValue[Key]) => {
    setValue(current => ({ ...current, [key]: fieldValue }));
    setValidationErrors(current => ({ ...current, [key]: undefined }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={pending}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit custom signal' : 'Create custom signal'}</DialogTitle>
          <DialogDescription>
            Definitions belong to the organization. Every signal receives all available bounded trace context.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Form
            id={formId}
            onSubmit={event => {
              event.preventDefault();
              const errors = validate(value, editing);
              setValidationErrors(errors);
              if (Object.keys(errors).length > 0) return;
              const action = definition
                ? onUpdate(definition.id, {
                    displayLabel: value.displayLabel,
                    description: value.description,
                    taskPrompt: value.taskPrompt,
                  })
                : onCreate(value);
              void action.then(() => onOpenChange(false)).catch(() => undefined);
            }}
          >
            <Field invalid={Boolean(validationErrors.name)} disabled={editing || pending}>
              <FieldLabel>Signal name</FieldLabel>
              <Input
                name="name"
                placeholder="handoff_quality"
                value={value.name}
                onChange={event => setField('name', event.target.value)}
              />
              <FieldDescription>A stable lowercase slug. It cannot be changed after creation.</FieldDescription>
              <FieldError>{validationErrors.name}</FieldError>
            </Field>
            <Field invalid={Boolean(validationErrors.displayLabel)} disabled={pending}>
              <FieldLabel>Display label</FieldLabel>
              <Input
                name="displayLabel"
                placeholder="Handoff quality"
                value={value.displayLabel}
                onChange={event => setField('displayLabel', event.target.value)}
              />
              <FieldError>{validationErrors.displayLabel}</FieldError>
            </Field>
            <Field disabled={pending}>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                name="description"
                rows={2}
                value={value.description}
                onChange={event => setField('description', event.target.value)}
              />
            </Field>
            <Field invalid={Boolean(validationErrors.taskPrompt)} disabled={pending}>
              <FieldLabel>Signal instructions</FieldLabel>
              <Textarea
                name="taskPrompt"
                rows={5}
                value={value.taskPrompt}
                placeholder="Describe what this signal should evaluate and how the result should be written."
                onChange={event => setField('taskPrompt', event.target.value)}
              />
              <FieldDescription>
                Tell the model what to evaluate and what the signal result should contain. {value.taskPrompt.length}
                /2,000 characters
              </FieldDescription>
              <FieldError>{validationErrors.taskPrompt}</FieldError>
            </Field>
            {editing ? (
              <Txt variant="meta" tone="muted">
                Instruction changes create a new version and apply only to new traces. Existing analysis is unchanged.
              </Txt>
            ) : null}
            {error ? (
              <div role="alert">
                <Notice variant="destructive">{error}</Notice>
              </div>
            ) : null}
          </Form>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction type="submit" form={formId}>
            {editing ? 'Save signal' : 'Create signal'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
