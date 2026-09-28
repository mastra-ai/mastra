// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Checkbox } from '../Checkbox';
import { CodeEditor } from '../CodeEditor';
import { Input } from '../Input';
import { RadioGroup, RadioGroupItem } from '../RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Switch } from '../Switch';
import { Textarea } from '../Textarea';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldItem,
  FieldLabel,
  Fieldset,
  FieldsetLegend,
} from './field';

afterEach(() => cleanup());

const controls: Array<{ kind: string; role: string; control: ReactElement }> = [
  { kind: 'Input', role: 'textbox', control: <Input /> },
  { kind: 'Textarea', role: 'textbox', control: <Textarea /> },
  {
    kind: 'Select',
    role: 'combobox',
    control: (
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
];

describe.each(controls)('$kind in a Field', ({ role, control }) => {
  it('is named by the label', () => {
    render(
      <Field>
        <FieldLabel>Kind</FieldLabel>
        {control}
      </Field>,
    );

    expect(screen.getByRole(role, { name: 'Kind' })).toBeTruthy();
  });

  it('keeps its name when the label is visually hidden', () => {
    render(
      <Field>
        <FieldLabel className="sr-only">Kind</FieldLabel>
        {control}
      </Field>,
    );

    expect(screen.getByRole(role, { name: 'Kind' })).toBeTruthy();
  });

  it('is marked invalid and described by the error', () => {
    render(
      <Field invalid>
        <FieldLabel>Kind</FieldLabel>
        {control}
        <FieldError>Pick a kind</FieldError>
      </Field>,
    );

    const element = screen.getByRole(role, { name: 'Kind' });
    expect(element.getAttribute('aria-invalid')).toBe('true');
    expect(element.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
  });
});

describe('Field', () => {
  it('describes the control with the description and leaves a healthy control unmarked', () => {
    render(
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldDescription>Used for sign-in</FieldDescription>
      </Field>,
    );

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Used for sign-in').id);
  });

  it('renders no alert without an error message', () => {
    render(
      <Field invalid>
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldError>{undefined}</FieldError>
      </Field>,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables the control from the field', () => {
    render(
      <Field disabled>
        <FieldLabel>Email</FieldLabel>
        <Input />
      </Field>,
    );

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Email' }).disabled).toBe(true);
  });

  it('keeps a controlled input in sync with its state', () => {
    function ControlledEmail() {
      const [email, setEmail] = useState('');
      return (
        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input value={email} onChange={event => setEmail(event.target.value.toUpperCase())} />
        </Field>
      );
    }
    render(<ControlledEmail />);

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Email' });
    fireEvent.change(input, { target: { value: 'ada' } });

    expect(input.value).toBe('ADA');
  });

  it('names a control Base UI cannot see, such as the code editor', () => {
    render(
      <Field invalid>
        <FieldLabel>Payload</FieldLabel>
        <CodeEditor value="{}" />
        <FieldError>Invalid JSON</FieldError>
      </Field>,
    );

    const editor = screen.getByRole('textbox', { name: 'Payload' });
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(editor.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });

  it('focuses the code editor when its label is clicked', () => {
    render(
      <Field>
        <FieldLabel>Payload</FieldLabel>
        <CodeEditor value="{}" />
      </Field>,
    );

    fireEvent.click(screen.getByText('Payload'));

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Payload' }));
  });

  it('marks the label required for sighted users and screen readers', () => {
    render(
      <Field>
        <FieldLabel required>Email</FieldLabel>
        <Input />
      </Field>,
    );

    expect(screen.getByRole('textbox', { name: 'Email (required)' })).toBeTruthy();
  });

  it('describes the control by an error inside the horizontal content column', () => {
    render(
      <Field orientation="horizontal">
        <FieldLabel>Region</FieldLabel>
        <FieldContent>
          <Input />
          <FieldError>Unknown region</FieldError>
        </FieldContent>
      </Field>,
    );

    const input = screen.getByRole('textbox', { name: 'Region' });
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});

describe('Fieldset', () => {
  it('names the group with its legend', () => {
    render(
      <Fieldset>
        <FieldsetLegend>Billing</FieldsetLegend>
        <Field>
          <FieldLabel>Company</FieldLabel>
          <Input />
        </Field>
      </Fieldset>,
    );

    expect(screen.getByRole('group', { name: 'Billing' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Company' })).toBeTruthy();
  });

  it('names a radio group by its legend and each radio by its own label', () => {
    const { container } = render(
      <Field>
        <Fieldset render={<RadioGroup defaultValue="none" />}>
          <FieldsetLegend>Sampling</FieldsetLegend>
          <FieldItem>
            <RadioGroupItem value="none" />
            <FieldLabel>None</FieldLabel>
          </FieldItem>
          <FieldItem>
            <RadioGroupItem value="ratio" />
            <FieldLabel>Ratio</FieldLabel>
          </FieldItem>
        </Fieldset>
      </Field>,
    );

    expect(screen.getByRole('radiogroup', { name: 'Sampling' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'None' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Ratio' })).toBeTruthy();
    const labelIds = [...container.querySelectorAll('label')].map(label => label.id);
    expect(new Set(labelIds).size).toBe(labelIds.length);
  });

  it('lets options keep their own names when the group sits in a labelled Field', () => {
    render(
      <Field>
        <FieldLabel>Theme</FieldLabel>
        <RadioGroup defaultValue="light">
          <FieldItem>
            <RadioGroupItem value="light" aria-label="Light" />
          </FieldItem>
          <FieldItem>
            <RadioGroupItem value="dark" aria-label="Dark" />
          </FieldItem>
        </RadioGroup>
      </Field>,
    );

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeTruthy();
  });

  it('names each radio by its label in a group without a surrounding Field', () => {
    render(
      <RadioGroup aria-label="Plan" defaultValue="free">
        <FieldItem>
          <RadioGroupItem value="free" />
          <FieldLabel>Free</FieldLabel>
        </FieldItem>
        <FieldItem>
          <RadioGroupItem value="team" />
          <FieldLabel>Team</FieldLabel>
        </FieldItem>
      </RadioGroup>,
    );

    fireEvent.click(screen.getByText('Team'));

    expect(screen.getByRole('radio', { name: 'Team' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe.each([
  { kind: 'Switch', role: 'switch', control: <Switch /> },
  { kind: 'Checkbox', role: 'checkbox', control: <Checkbox /> },
])('$kind in a horizontal Field', ({ role, control }) => {
  it('is named by the label beside it', () => {
    render(
      <Field orientation="horizontal">
        {control}
        <FieldLabel>Stream responses</FieldLabel>
      </Field>,
    );

    expect(screen.getByRole(role, { name: 'Stream responses' })).toBeTruthy();
  });
});
