// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FieldBlock } from './block/field-block';
import { TextFieldBlock } from './fields/text-field-block';

afterEach(() => cleanup());

const messageContainer = (container: HTMLElement) => container.querySelector('.h-lh');

describe('TextFieldBlock message', () => {
  describe('when neither helpText nor errorMsg is provided', () => {
    it('does not render the message container', () => {
      const { container } = render(<TextFieldBlock name="email" label="Email" />);

      expect(messageContainer(container)).toBeNull();
    });
  });

  describe('when helpText is provided', () => {
    it('renders the message container', () => {
      const { container } = render(<TextFieldBlock name="email" label="Email" helpText="Use your work email." />);

      expect(messageContainer(container)).not.toBeNull();
      expect(screen.getByText('Use your work email.')).toBeDefined();
    });
  });
});

describe('FieldBlock error wiring', () => {
  it('ties the message to its control so the reason is announced with the field', () => {
    render(<TextFieldBlock name="email" label="Email" errorMsg="Your email must include an @ symbol." />);

    const input = screen.getByLabelText('Email');
    const message = screen.getByRole('alert');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('error-email');
    expect(input.parentElement?.className).toContain('gap-1');
    expect(input.parentElement?.parentElement?.className).toContain('gap-2');
    expect(message.id).toBe('error-email');
    expect(message.textContent).toContain('@ symbol');
    expect(message.parentElement?.className).toContain('h-lh');
  });

  it('leaves a healthy field unmarked', () => {
    render(<TextFieldBlock name="email" label="Email" />);

    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

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

  it('announces without the caller wrapping it', () => {
    render(<FieldBlock.ErrorMsg name="token">Token is required.</FieldBlock.ErrorMsg>);

    const message = screen.getByRole('alert');
    expect(message.id).toBe('error-token');
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

  it('labels a field as primary control text with a required asterisk', () => {
    render(
      <FieldBlock.Label name="email" required>
        Email
      </FieldBlock.Label>,
    );

    expect(screen.getByText('(required)').closest('label')).not.toBeNull();
    expect(screen.getByText('*').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('(required)').className).toContain('sr-only');
  });

  it('uses one reserved line for helper text or an error', () => {
    const { container } = render(
      <FieldBlock.Message name="email" helpText="Use your work email." errorMsg="Email is required." />,
    );

    expect(container.firstElementChild?.className).toContain('h-lh');
    expect(screen.getByRole('alert').textContent).toBe('Email is required.');
    expect(screen.queryByText('Use your work email.')).toBeNull();
  });
});
