// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
          <Input id="command" font="mono" defaultValue="pnpm test" />
        </>,
      );
      expect(screen.getByRole('textbox', { name: 'Command' })).toHaveProperty('value', 'pnpm test');
    });
  });

  describe('when composing a router link', () => {
    it('preserves client-side navigation', () => {
      render(
        <MemoryRouter>
          <Routes>
            <Route
              path="/"
              element={
                <Txt variant="caption" render={<Link to="/details" />}>
                  Details
                </Txt>
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

  describe('when the rendered element and Txt both receive a ref', () => {
    it('attaches both refs to the same native element', () => {
      const textRef = createRef<HTMLElement>();
      const linkRef = createRef<HTMLAnchorElement>();
      render(
        <Txt ref={textRef} variant="caption" render={<a ref={linkRef} href="#details" />}>
          Details
        </Txt>,
      );
      expect(textRef.current).toBe(screen.getByRole('link', { name: 'Details' }));
      expect(linkRef.current).toBe(textRef.current);
    });
  });

  describe('when the rendered element and Txt both have a click handler', () => {
    it('calls both handlers for a single activation', () => {
      const onTextClick = vi.fn();
      const onButtonClick = vi.fn();
      render(
        <Txt
          as="button"
          variant="label"
          onClick={onTextClick}
          render={<button type="button" onClick={onButtonClick} />}
        >
          Run
        </Txt>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onTextClick).toHaveBeenCalledOnce();
      expect(onButtonClick).toHaveBeenCalledOnce();
    });
  });

  describe('when a native button is disabled', () => {
    it('does not activate its handler', () => {
      const onClick = vi.fn();
      render(
        <Txt as="button" variant="label" disabled onClick={onClick}>
          Run
        </Txt>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
