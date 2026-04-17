import { Button, Input, Label, Textarea } from '@mastra/playground-ui';
import { useState } from 'react';

export type SkillFormValues = {
  name: string;
  description: string;
  instructions: string;
  license: string;
};

export interface SkillFormProps {
  initialValues?: Partial<SkillFormValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: SkillFormValues) => void;
  onCancel?: () => void;
}

export function SkillForm({ initialValues, submitLabel, isSubmitting, onSubmit, onCancel }: SkillFormProps) {
  const [values, setValues] = useState<SkillFormValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    instructions: initialValues?.instructions ?? '',
    license: initialValues?.license ?? '',
  });

  const update = <K extends keyof SkillFormValues>(key: K, value: SkillFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.name.trim() || !values.instructions.trim()) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl" data-testid="skill-form">
      <div className="space-y-1.5">
        <Label htmlFor="skill-name">Name</Label>
        <Input
          id="skill-name"
          value={values.name}
          onChange={event => update('name', event.target.value)}
          placeholder="My awesome skill"
          required
          testId="skill-name-input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skill-description">Description</Label>
        <Input
          id="skill-description"
          value={values.description}
          onChange={event => update('description', event.target.value)}
          placeholder="What does this skill do?"
          testId="skill-description-input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skill-instructions">Instructions</Label>
        <Textarea
          id="skill-instructions"
          value={values.instructions}
          onChange={event => update('instructions', event.target.value)}
          placeholder="Write the system instructions for this skill in markdown."
          rows={10}
          required
          testId="skill-instructions-input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skill-license">License (optional)</Label>
        <Input
          id="skill-license"
          value={values.license}
          onChange={event => update('license', event.target.value)}
          placeholder="e.g. MIT"
          testId="skill-license-input"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="default" disabled={isSubmitting} data-testid="skill-form-submit">
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="light" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
