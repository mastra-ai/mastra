// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import { Composer, ComposerActions, ComposerAttachments, ComposerBox, ComposerInput, ComposerRing } from './composer';

afterEach(() => {
  cleanup();
});

const ControlledComposer = () => {
  const [value, setValue] = useState('Hello');

  return (
    <Composer aria-label="Message composer">
      <ComposerAttachments aria-label="Attachments">
        <span>notes.txt</span>
      </ComposerAttachments>
      <ComposerBox>
        <ComposerInput
          aria-label="Message"
          value={value}
          onChange={event => {
            setValue(event.target.value);
          }}
        />
        <ComposerActions aria-label="Composer actions">
          <button type="submit">Send message</button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  );
};

describe('Composer', () => {
  describe('when composed with all regions', () => {
    it('renders a semantic form with stable slots', () => {
      render(<ControlledComposer />);

      const form = screen.getByRole('form', { name: 'Message composer' });
      expect(form.getAttribute('data-slot')).toBe('composer');
      const attachments = screen.getByRole('region', { name: 'Attachments' });
      const box = document.querySelector('[data-slot="composer-box"]');
      assert(box);
      expect(attachments.getAttribute('data-slot')).toBe('composer-attachments');
      expect(attachments.parentElement).toBe(form);
      expect(box.parentElement).toBe(form);
      expect(attachments.nextElementSibling).toBe(box);
      expect(screen.getByRole('textbox', { name: 'Message' }).getAttribute('data-slot')).toBe('composer-input');
      expect(screen.getByRole('region', { name: 'Composer actions' }).getAttribute('data-slot')).toBe(
        'composer-actions',
      );
    });

    it('submits through the root form', () => {
      const onSubmit = vi.fn<(event: React.FormEvent<HTMLFormElement>) => void>(event => {
        event.preventDefault();
      });

      render(
        <Composer aria-label="Message composer" onSubmit={onSubmit}>
          <ComposerInput aria-label="Message" />
          <ComposerActions>
            <button type="submit">Send message</button>
          </ComposerActions>
        </Composer>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it('renders arbitrary attachment and action children', () => {
      render(<ControlledComposer />);

      expect(screen.getByText('notes.txt')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Send message' })).not.toBeNull();
    });
  });

  describe('when the input is controlled', () => {
    it('updates from the caller change handler', () => {
      render(<ControlledComposer />);
      const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });

      fireEvent.change(input, { target: { value: 'Updated message' } });

      expect(input.value).toBe('Updated message');
    });

    it('forwards the textarea ref', () => {
      const ref = createRef<HTMLTextAreaElement>();

      render(
        <Composer>
          <ComposerInput ref={ref} aria-label="Message" />
        </Composer>,
      );

      expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Message' }));
    });
  });

  describe('when the input viewport height is configured', () => {
    it('applies the limit to the scrolling viewport instead of the textarea', () => {
      render(
        <Composer>
          <ComposerInput aria-label="Message" maxHeight="16rem" />
        </Composer>,
      );

      const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
      const viewport = document.querySelector<HTMLElement>('[style*="max-height"]');
      assert(viewport);
      expect(viewport.style.maxHeight).toBe('16rem');
      expect(input.style.maxHeight).toBe('');
    });
  });

  describe('when optional regions are omitted', () => {
    it('renders only the provided input region', () => {
      render(
        <Composer aria-label="Message composer">
          <ComposerInput aria-label="Message" />
        </Composer>,
      );

      expect(screen.getByRole('textbox', { name: 'Message' })).not.toBeNull();
      expect(document.querySelector('[data-slot="composer-attachments"]')).toBeNull();
      expect(document.querySelector('[data-slot="composer-actions"]')).toBeNull();
    });
  });

  describe('when native presentation props are provided', () => {
    it('passes disabled and read-only state to the textarea', () => {
      render(
        <Composer>
          <ComposerInput aria-label="Message" disabled readOnly />
        </Composer>,
      );

      const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
      expect(input.disabled).toBe(true);
      expect(input.readOnly).toBe(true);
    });

    it('merges custom classes and native DOM props on every piece', () => {
      render(
        <Composer className="custom-root" data-testid="composer-root">
          <ComposerAttachments className="custom-attachments" data-testid="composer-attachments">
            Attachment
          </ComposerAttachments>
          <ComposerBox className="custom-box" data-testid="composer-box">
            <ComposerInput className="custom-input" data-testid="composer-input" />
            <ComposerActions className="custom-actions" data-testid="composer-actions">
              Actions
            </ComposerActions>
          </ComposerBox>
        </Composer>,
      );

      const root = screen.getByTestId('composer-root');
      const attachments = screen.getByTestId('composer-attachments');
      const box = screen.getByTestId('composer-box');
      const input = screen.getByTestId('composer-input');
      const actions = screen.getByTestId('composer-actions');
      assert(root.classList.contains('custom-root'));
      assert(attachments.classList.contains('custom-attachments'));
      assert(box.classList.contains('custom-box'));
      assert(input.classList.contains('custom-input'));
      assert(actions.classList.contains('custom-actions'));
    });
  });

  describe('when a sending pulse is active', () => {
    it('renders the controlled pulse as decorative content', () => {
      render(
        <Composer>
          <ComposerBox sendingPulseKey={2}>
            <ComposerInput aria-label="Message" />
          </ComposerBox>
        </Composer>,
      );

      const pulse = document.querySelector('[data-slot="composer-sending-pulse"]');
      assert(pulse);
      expect(pulse.getAttribute('aria-hidden')).toBe('true');
      expect(pulse.childElementCount).toBe(3);
    });
  });

  describe('when the ring is idle', () => {
    it('aims the glow relative to the ring when moving over its input', () => {
      render(
        <ComposerRing>
          <ComposerBox>
            <ComposerInput aria-label="Message" />
          </ComposerBox>
        </ComposerRing>,
      );

      const ring = document.querySelector<HTMLElement>('[data-slot="composer-ring"]');
      assert(ring);
      expect(ring.getAttribute('data-busy')).toBe('false');

      vi.spyOn(ring, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 30, 200, 100));
      const input = screen.getByRole('textbox', { name: 'Message' });
      fireEvent(input, new MouseEvent('pointermove', { bubbles: true, clientX: 320, clientY: 80 }));

      expect(ring.style.getPropertyValue('--composer-ring-angle')).toBe('90deg');
      expect(ring.style.getPropertyValue('--composer-spotlight-x')).toBe('300px');
      expect(ring.style.getPropertyValue('--composer-spotlight-y')).toBe('50px');

      fireEvent(window, new MouseEvent('pointermove', { clientX: 0, clientY: 0 }));
      expect(ring.style.getPropertyValue('--composer-spotlight-x')).toBe('300px');
    });
  });

  describe('when the ring is busy', () => {
    it('stops tracking while busy and resumes when idle', () => {
      const { rerender } = render(
        <ComposerRing busy>
          <ComposerBox>
            <ComposerInput aria-label="Message" />
          </ComposerBox>
        </ComposerRing>,
      );

      const ring = document.querySelector<HTMLElement>('[data-slot="composer-ring"]');
      assert(ring);
      fireEvent(ring, new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 0 }));
      expect(ring.getAttribute('data-busy')).toBe('true');
      expect(ring.style.getPropertyValue('--composer-ring-angle')).toBe('');
      expect(ring.style.getPropertyValue('--composer-spotlight-x')).toBe('');

      rerender(<ComposerRing />);
      fireEvent(ring, new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 0 }));
      expect(ring.style.getPropertyValue('--composer-ring-angle')).toBe('90deg');

      rerender(<ComposerRing busy />);
      fireEvent(ring, new MouseEvent('pointermove', { bubbles: true, clientX: 0, clientY: 100 }));
      expect(ring.style.getPropertyValue('--composer-ring-angle')).toBe('90deg');
    });
  });

  it('preserves caller pointer handlers and styles, including cancellation', () => {
    const onPointerEnter = vi.fn();
    const onPointerMove = vi.fn<React.PointerEventHandler<HTMLDivElement>>(event => event.preventDefault());
    render(<ComposerRing onPointerEnter={onPointerEnter} onPointerMove={onPointerMove} style={{ opacity: 0.5 }} />);
    const ring = document.querySelector<HTMLElement>('[data-slot="composer-ring"]');
    assert(ring);

    fireEvent(ring, new MouseEvent('pointerover', { bubbles: true, clientX: 100, clientY: 0 }));
    expect(onPointerEnter).toHaveBeenCalledOnce();
    expect(ring.style.getPropertyValue('--composer-ring-angle')).toBe('90deg');
    expect(ring.style.opacity).toBe('0.5');

    fireEvent(ring, new MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 0, clientY: 100 }));
    expect(onPointerMove).toHaveBeenCalledOnce();
    expect(ring.style.getPropertyValue('--composer-ring-angle')).toBe('90deg');
  });

  describe('when no sending pulse has been triggered', () => {
    it('omits the pulse content', () => {
      render(
        <Composer>
          <ComposerBox sendingPulseKey={0}>
            <ComposerInput aria-label="Message" />
          </ComposerBox>
        </Composer>,
      );

      expect(document.querySelector('[data-slot="composer-sending-pulse"]')).toBeNull();
    });
  });
});
