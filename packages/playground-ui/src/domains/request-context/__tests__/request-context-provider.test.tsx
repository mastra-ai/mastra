// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  RequestContextProvider,
  getRequestContextStorageKey,
  useOptionalRequestContext,
  useRequestContext,
} from '../context/request-context-provider';

const ENTITY_KEY = 'agent:weather-agent';
const STORAGE_KEY = getRequestContextStorageKey(ENTITY_KEY);

function Probe() {
  const { requestContext, setRequestContext, clearRequestContext } = useRequestContext();
  return (
    <div>
      <pre data-testid="value">{JSON.stringify(requestContext)}</pre>
      <button type="button" onClick={() => setRequestContext({ userId: 'u-1' })}>
        set
      </button>
      <button type="button" onClick={clearRequestContext}>
        clear
      </button>
    </div>
  );
}

function OptionalProbe() {
  return <pre data-testid="value">{JSON.stringify(useOptionalRequestContext())}</pre>;
}

const renderProvider = () =>
  render(
    <RequestContextProvider entityKey={ENTITY_KEY}>
      <Probe />
    </RequestContextProvider>,
  );

describe('RequestContextProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('when a value is saved', () => {
    it('persists it under the entity storage key', () => {
      renderProvider();

      act(() => {
        screen.getByRole('button', { name: 'set' }).click();
      });

      expect(screen.getByTestId('value').textContent).toBe('{"userId":"u-1"}');
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({ userId: 'u-1' });
    });

    it('resets to an empty object when cleared', () => {
      renderProvider();

      act(() => {
        screen.getByRole('button', { name: 'set' }).click();
      });
      act(() => {
        screen.getByRole('button', { name: 'clear' }).click();
      });

      expect(screen.getByTestId('value').textContent).toBe('{}');
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({});
    });
  });

  describe('when the provider remounts with the same entity key', () => {
    it('restores the persisted value', () => {
      const first = renderProvider();
      act(() => {
        screen.getByRole('button', { name: 'set' }).click();
      });
      first.unmount();

      renderProvider();

      expect(screen.getByTestId('value').textContent).toBe('{"userId":"u-1"}');
    });
  });

  describe('when another entity has a persisted value', () => {
    it('starts empty for the current entity', () => {
      window.localStorage.setItem(getRequestContextStorageKey('agent:other'), JSON.stringify({ userId: 'other' }));

      renderProvider();

      expect(screen.getByTestId('value').textContent).toBe('{}');
    });
  });

  describe('when localStorage holds invalid JSON', () => {
    it('falls back to an empty object', () => {
      window.localStorage.setItem(STORAGE_KEY, '{not json');

      renderProvider();

      expect(screen.getByTestId('value').textContent).toBe('{}');
    });
  });

  describe('when localStorage holds a non-object value', () => {
    it('falls back to an empty object', () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify('a string'));

      renderProvider();

      expect(screen.getByTestId('value').textContent).toBe('{}');
    });
  });

  describe('when useRequestContext is used outside a provider', () => {
    it('throws', () => {
      expect(() => render(<Probe />)).toThrow('useRequestContext must be used within a RequestContextProvider');
    });
  });

  describe('when useOptionalRequestContext is used outside a provider', () => {
    it('returns an empty object', () => {
      render(<OptionalProbe />);

      expect(screen.getByTestId('value').textContent).toBe('{}');
    });
  });
});
