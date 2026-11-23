// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from '../Input';
import { Txt } from './Txt';

afterEach(cleanup);

describe('Txt', () => {
  describe('when rendering a label for a monospace input', () => {
    it('keeps the input accessible by its label', () => {
      render(
        <>
          <Txt as="label" htmlFor="command" variant="label">
            Command
          </Txt>
          <Input className="font-mono" id="command" defaultValue="pnpm test" />
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Command' })).toHaveProperty('value', 'pnpm test');
    });
  });

  describe('when text receives a ref', () => {
    it('attaches the ref to the native text element', () => {
      const textRef = createRef<HTMLElement>();
      render(
        <Txt as="span" ref={textRef}>
          Details
        </Txt>,
      );
      expect(textRef.current).toBe(screen.getByText('Details'));
    });
  });
});
