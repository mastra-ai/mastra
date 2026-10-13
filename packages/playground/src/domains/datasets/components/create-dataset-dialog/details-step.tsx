import {
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { Textarea } from '@mastra/playground-ui/components/Textarea';

export interface DetailsStepProps {
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onNext: () => void;
}

export function DetailsStep({ name, description, onNameChange, onDescriptionChange, onNext }: DetailsStepProps) {
  const hasName = name.trim().length > 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create dataset</DialogTitle>
        <DialogDescription>Give your dataset a name. You can add a schema and items next.</DialogDescription>
      </DialogHeader>
      <Form
        onSubmit={event => {
          event.preventDefault();
          if (hasName) onNext();
        }}
      >
        <DialogBody>
          <Field>
            <FieldLabel required>Name</FieldLabel>
            <Input
              required
              value={name}
              onChange={event => onNameChange(event.target.value)}
              placeholder="Enter dataset name"
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={description}
              onChange={event => onDescriptionChange(event.target.value)}
              placeholder="Enter dataset description (optional)"
              rows={2}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction type="submit" disabled={!hasName} disabledTooltip="Enter a dataset name to continue">
            Next
          </DialogAction>
        </DialogFooter>
      </Form>
    </>
  );
}
