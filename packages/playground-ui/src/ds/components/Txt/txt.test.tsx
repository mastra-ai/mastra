// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
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

  describe('when text is inside a router link', () => {
    it('preserves client-side navigation owned by the link', () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route
              path="/"
              element={
                <Link to="/details">
                  <Txt as="span" variant="caption">
                    Details
                  </Txt>
                </Link>
              }
            />
            <Route path="/details" element={<h1>Details page</h1>} />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('link', { name: 'Details' }));
      expect(screen.getByRole('heading', { name: 'Details page' })).toBeTruthy();
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
