import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { FormLayout } from '@mastra/playground-ui/components/FormLayout';
import type { FormLayoutProps } from '@mastra/playground-ui/components/FormLayout';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import {
  SettingsContainer,
  SettingsGroup,
  SettingsHeader,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

export type NewProject = { name: string; model: string; size: string };

export type CreateFailure = { title: string; message: string };

export type CreateProjectProps = {
  projectsHref: string;
  LinkComponent?: FormLayoutProps['LinkComponent'];
  models: ComboboxOption[];
  sizes: ComboboxOption[];
  onCreate: (project: NewProject) => Promise<CreateFailure | undefined>;
  onCancel: () => void;
};

const nameHint = 'Give the project a name, for example “support-agent”.';

export function CreateProject({ projectsHref, LinkComponent, models, sizes, onCreate, onCancel }: CreateProjectProps) {
  const [name, setName] = useState('');
  const [model, setModel] = useState(models[0]?.value ?? '');
  const [size, setSize] = useState(sizes[0]?.value ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<CreateFailure>();
  const nameError = submitted && name.trim() === '' ? nameHint : undefined;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (name.trim() === '') return;
    setBusy(true);
    setFailure(undefined);
    const result = await onCreate({ name: name.trim(), model, size });
    setFailure(result);
    setBusy(false);
  }

  return (
    <FormLayout backHref={projectsHref} backLabel="Projects" title="New project" LinkComponent={LinkComponent}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <Field invalid={Boolean(nameError)} disabled={busy}>
          <FieldLabel required>Project name</FieldLabel>
          <Input
            name="project-name"
            placeholder="support-agent"
            autoFocus
            value={name}
            onChange={event => setName(event.target.value)}
          />
          <FieldError>{nameError}</FieldError>
        </Field>
        <SettingsGroup>
          <SettingsHeader>
            <SettingsTitle>Runtime and cost</SettingsTitle>
          </SettingsHeader>
          <SettingsContainer>
            <SettingsRow label="Model">
              <Combobox className="w-56" options={models} value={model} onValueChange={setModel} disabled={busy} />
            </SettingsRow>
            <SettingsRow label="Server size">
              <Combobox className="w-56" options={sizes} value={size} onValueChange={setSize} disabled={busy} />
            </SettingsRow>
          </SettingsContainer>
        </SettingsGroup>
        {failure && (
          <Notice variant="destructive" title={failure.title}>
            <Notice.Message>{failure.message}</Notice.Message>
          </Notice>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy} icon={busy ? <Spinner size="sm" /> : undefined}>
            {busy ? 'Creating' : 'Create'}
          </Button>
          <Button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </FormLayout>
  );
}
