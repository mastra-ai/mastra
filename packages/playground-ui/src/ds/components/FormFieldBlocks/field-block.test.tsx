// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FieldBlock } from './block/field-block';
import type { FieldBlockProps } from './block/field-block';
import { SelectFieldBlock } from './fields/select-field-block';
import { TextFieldBlock } from './fields/text-field-block';
import { TextareaFieldBlock } from './fields/textarea-field-block';

afterEach(() => cleanup());

const messageLine = (container: HTMLElement) => container.querySelector('.h-\\[1lh\\]');

type LabelledFieldProps = Pick<FieldBlockProps, 'labelIsHidden' | 'layout' | 'errorMsg'>;

const fields: Array<{ kind: string; role: string; field: (props: LabelledFieldProps) => ReactElement }> = [
  { kind: 'TextFieldBlock', role: 'textbox', field: props => <TextFieldBlock name="kind" label="Kind" {...props} /> },
  {
    kind: 'TextareaFieldBlock',
    role: 'textbox',
    field: props => <TextareaFieldBlock name="kind" label="Kind" {...props} />,
  },
  {
    kind: 'SelectFieldBlock',
    role: 'combobox',
    field: props => (
      <SelectFieldBlock
        name="kind"
        label="Kind"
        options={[{ value: 'a', label: 'A' }]}
        onValueChange={() => {}}
        {...props}
      />
    ),
  },
];

describe.each(fields)('$kind', ({ role, field }) => {
  it('keeps its accessible name when the label is hidden', () => {
    render(field({ labelIsHidden: true }));

    const control = screen.getByRole(role, { name: 'Kind' });
    expect(control.id).toBe('input-kind');
    expect(screen.getByText('Kind').classList.contains('sr-only')).toBe(true);
  });

  it('keeps its accessible name when a horizontal label is hidden, and gives the control the full row', () => {
    const { container } = render(field({ labelIsHidden: true, layout: 'horizontal' }));

    const [labelColumn, controlColumn] = container.firstElementChild?.children ?? [];
    expect(screen.getByRole(role, { name: 'Kind' }).id).toBe('input-kind');
    expect(labelColumn?.classList.contains('sr-only')).toBe(true);
    expect(controlColumn?.classList.contains('col-span-full')).toBe(true);
  });

  it('ties its error message to the control', () => {
    render(field({ errorMsg: 'Pick a kind.' }));

    const control = screen.getByRole(role, { name: 'Kind' });
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')).toBe('error-kind');
    expect(screen.getByRole('alert').id).toBe('error-kind');
  });
});

describe('FieldBlock', () => {
  it('names, describes and invalidates any control it wraps, even one a label cannot point at', () => {
    render(
      <FieldBlock name="payload" label="Payload" errorMsg="Payload must be JSON.">
        {control => <div role="textbox" tabIndex={0} {...control} />}
      </FieldBlock>,
    );

    const control = screen.getByRole('textbox', { name: 'Payload' });
    expect(control.id).toBe('input-payload');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')).toBe('error-payload');
  });

  it('leaves a healthy control unmarked', () => {
    render(
      <FieldBlock name="payload" label="Payload" helpText="Sent as the request body.">
        {control => <input {...control} />}
      </FieldBlock>,
    );

    const control = screen.getByLabelText('Payload');
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(control.hasAttribute('aria-describedby')).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders no message line when it has nothing to say', () => {
    const { container } = render(<FieldBlock name="payload">{control => <input {...control} />}</FieldBlock>);

    expect(messageLine(container)).toBeNull();
  });

  it('uses one reserved line for helper text or an error, the error winning', () => {
    const { container } = render(
      <FieldBlock name="email" label="Email" helpText="Use your work email." errorMsg="Email is required.">
        {control => <input {...control} />}
      </FieldBlock>,
    );

    expect(messageLine(container)).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Email is required.');
    expect(screen.queryByText('Use your work email.')).toBeNull();
  });

  it('shows helper text on the reserved line when there is no error', () => {
    const { container } = render(
      <FieldBlock name="email" label="Email" helpText="Use your work email.">
        {control => <input {...control} />}
      </FieldBlock>,
    );

    expect(messageLine(container)?.textContent).toBe('Use your work email.');
  });
});

describe('TextFieldBlock error state', () => {
  it('preserves caller descriptions alongside the error message', () => {
    render(
      <TextFieldBlock
        name="email"
        label="Email"
        aria-describedby="email-help"
        errorMsg="Your email must include an @ symbol."
      />,
    );

    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toBe('email-help error-email');
  });

  it('preserves an explicit error state without a message', () => {
    render(<TextFieldBlock name="email" label="Email" error />);

    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toBeNull();
  });
});

describe('FieldBlock.ErrorMsg', () => {
  it('announces without the caller wrapping it', () => {
    render(<FieldBlock.ErrorMsg name="token">Token is required.</FieldBlock.ErrorMsg>);

    expect(screen.getByRole('alert').id).toBe('error-token');
  });

  it('marks the message with an icon so the error does not rely on color alone', () => {
    render(<FieldBlock.ErrorMsg name="token">Token is required.</FieldBlock.ErrorMsg>);

    const message = screen.getByRole('alert');
    expect(message.querySelector('[data-slot="icon"] svg')).not.toBeNull();
    expect(message.textContent).toBe('Token is required.');
  });

  it('matches the generated error ID for an empty field name', () => {
    render(<FieldBlock.ErrorMsg name="">Required.</FieldBlock.ErrorMsg>);

    expect(screen.getByRole('alert').id).toBe('error-');
  });
});

describe('FieldBlock.Label', () => {
  it('supports controls whose id does not use the field prefix', () => {
    render(
      <>
        <FieldBlock.Label name="schema" htmlFor="schema-editor">
          Schema
        </FieldBlock.Label>
        <textarea id="schema-editor" />
      </>,
    );

    expect(screen.getByLabelText('Schema').id).toBe('schema-editor');
  });

  it('marks a required field for sighted and screen reader users alike', () => {
    render(
      <FieldBlock.Label name="email" required>
        Email
      </FieldBlock.Label>,
    );

    expect(screen.getByText('(required)').closest('label')).not.toBeNull();
    expect(screen.getByText('*').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('(required)').className).toContain('sr-only');
  });
});
