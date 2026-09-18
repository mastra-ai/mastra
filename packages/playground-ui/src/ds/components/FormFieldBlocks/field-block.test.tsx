// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FieldBlock } from './block/field-block';
import { TextFieldBlock } from './fields/text-field-block';

afterEach(() => cleanup());

describe('FieldBlock error wiring', () => {
  it('ties the message to its control so the reason is announced with the field', () => {
    render(<TextFieldBlock name="email" label="Email" errorMsg="Your email must include an @ symbol." />);

    const input = screen.getByLabelText('Email');
    const message = screen.getByRole('alert');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('error-email');
    expect(message.id).toBe('error-email');
    expect(message.textContent).toContain('@ symbol');
  });

  it('leaves a healthy field unmarked', () => {
    render(<TextFieldBlock name="email" label="Email" />);

    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces without the caller wrapping it', () => {
    render(<FieldBlock.ErrorMsg name="token">Token is required.</FieldBlock.ErrorMsg>);

    const message = screen.getByRole('alert');
    expect(message.id).toBe('error-token');
    // Error state carries an icon as well as colour, so it survives colour blindness.
    expect(message.querySelector('svg')).not.toBeNull();
  });

  it('labels a field at the secondary text role, with required as metadata', () => {
    render(
      <FieldBlock.Label name="email" required>
        Email
      </FieldBlock.Label>,
    );

    const label = screen.getByText('Email');
    expect(label.className).toContain('text-ui-sm');
    expect(label.className).toContain('text-muted-foreground');

    const required = screen.getByText('(required)');
    expect(required.tagName).toBe('SPAN');
    expect(required.className).toContain('text-ui-xs');
  });
});
