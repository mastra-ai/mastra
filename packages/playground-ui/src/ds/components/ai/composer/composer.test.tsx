// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Composer,
  ComposerActionButton,
  ComposerActions,
  ComposerAttachment,
  ComposerAttachmentRemove,
  ComposerAttachments,
  ComposerBox,
  ComposerInput,
  ComposerSubmitButton,
} from './composer';

afterEach(cleanup);

describe('Composer', () => {
  describe('when composed as a message form', () => {
    it('submits through native form semantics', () => {
      const onSubmit = vi.fn(event => event.preventDefault());

      render(
        <Composer onSubmit={onSubmit} aria-label="Message composer">
          <ComposerBox>
            <ComposerInput aria-label="Message" />
            <ComposerActions>
              <ComposerSubmitButton>Send</ComposerSubmitButton>
            </ComposerActions>
          </ComposerBox>
        </Composer>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(screen.getByRole('form', { name: 'Message composer' })).toBeTruthy();
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  describe('when the input is controlled', () => {
    it('forwards textarea props and its ref', () => {
      const inputRef = createRef<HTMLTextAreaElement>();

      function ControlledComposer() {
        const [value, setValue] = useState('Draft');
        return (
          <Composer>
            <ComposerInput
              ref={inputRef}
              value={value}
              onChange={event => setValue(event.target.value)}
              aria-label="Message"
              data-purpose="composer-input"
            />
          </Composer>
        );
      }

      render(<ControlledComposer />);
      const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
      fireEvent.change(input, { target: { value: 'Updated draft' } });

      expect(input.value).toBe('Updated draft');
      expect(input.dataset.purpose).toBe('composer-input');
      expect(inputRef.current).toBe(input);
    });
  });

  describe('when attachments are composed', () => {
    it('renders preview content and a non-submitting removal control', () => {
      const onSubmit = vi.fn(event => event.preventDefault());
      const onRemove = vi.fn();

      render(
        <Composer onSubmit={onSubmit}>
          <ComposerAttachments aria-label="Attachments">
            <ComposerAttachment>
              <img src="image.png" alt="Diagram" />
              <ComposerAttachmentRemove onClick={onRemove}>Remove</ComposerAttachmentRemove>
            </ComposerAttachment>
          </ComposerAttachments>
        </Composer>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

      expect(screen.getByRole('img', { name: 'Diagram' })).toBeTruthy();
      expect(onRemove).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Remove' }).getAttribute('type')).toBe('button');
    });
  });

  describe('when actions are composed', () => {
    it('keeps utility actions non-submitting and submit actions submitting', () => {
      render(
        <Composer>
          <ComposerActions>
            <ComposerActionButton>Attach</ComposerActionButton>
            <ComposerSubmitButton>Send</ComposerSubmitButton>
          </ComposerActions>
        </Composer>,
      );

      expect(screen.getByRole('button', { name: 'Attach' }).getAttribute('type')).toBe('button');
      expect(screen.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
    });
  });

  describe('when controls are disabled', () => {
    it('preserves disabled states', () => {
      render(
        <Composer>
          <ComposerInput aria-label="Message" disabled />
          <ComposerActions>
            <ComposerActionButton disabled>Attach</ComposerActionButton>
            <ComposerSubmitButton disabled>Send</ComposerSubmitButton>
          </ComposerActions>
        </Composer>,
      );

      expect(screen.getByRole('textbox', { name: 'Message' }).hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
    });
  });

  describe('when consumer classes are provided', () => {
    it('merges them onto each public slot', () => {
      render(
        <Composer className="consumer-root">
          <ComposerBox className="consumer-box">
            <ComposerAttachments className="consumer-attachments">
              <ComposerAttachment className="consumer-attachment">
                <ComposerAttachmentRemove className="consumer-remove">Remove</ComposerAttachmentRemove>
              </ComposerAttachment>
            </ComposerAttachments>
            <ComposerInput className="consumer-input" aria-label="Message" />
            <ComposerActions className="consumer-actions">
              <ComposerActionButton className="consumer-action">Attach</ComposerActionButton>
              <ComposerSubmitButton className="consumer-submit">Send</ComposerSubmitButton>
            </ComposerActions>
          </ComposerBox>
        </Composer>,
      );

      expect(screen.getByRole('textbox', { name: 'Message' }).className).toContain('consumer-input');
      expect(screen.getByRole('button', { name: 'Remove' }).className).toContain('consumer-remove');
      expect(screen.getByRole('button', { name: 'Attach' }).className).toContain('consumer-action');
      expect(screen.getByRole('button', { name: 'Send' }).className).toContain('consumer-submit');
      expect(document.querySelector('[data-slot="composer"]')?.className).toContain('consumer-root');
      expect(document.querySelector('[data-slot="composer-box"]')?.className).toContain('consumer-box');
      expect(document.querySelector('[data-slot="composer-attachments"]')?.className).toContain('consumer-attachments');
      expect(document.querySelector('[data-slot="composer-attachment"]')?.className).toContain('consumer-attachment');
      expect(document.querySelector('[data-slot="composer-actions"]')?.className).toContain('consumer-actions');
    });
  });
});
