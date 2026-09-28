import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { RequestContextEntityType } from '../use-entity-request-context';
import { useEntityRequestContext } from '../use-entity-request-context';

function Probe({
  testId,
  entityType,
  entityId,
}: {
  testId: string;
  entityType: RequestContextEntityType;
  entityId: string;
}) {
  const [value, setValue] = useEntityRequestContext(entityType, entityId);
  return (
    <>
      <output data-testid={testId}>{JSON.stringify(value)}</output>
      <button type="button" onClick={() => setValue({ tenantId: testId })}>
        set-{testId}
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('useEntityRequestContext', () => {
  describe('when two components read the same entity', () => {
    it('shares updates between them and persists to localStorage', () => {
      render(
        <>
          <Probe testId="a" entityType="agent" entityId="agent-1" />
          <Probe testId="b" entityType="agent" entityId="agent-1" />
        </>,
      );

      act(() => screen.getByRole('button', { name: 'set-a' }).click());

      expect(screen.getByTestId('b').textContent).toBe('{"tenantId":"a"}');
      expect(window.localStorage.getItem('mastra-request-context:agent:agent-1')).toBe('{"tenantId":"a"}');
    });
  });

  describe('when two components read different entities', () => {
    it('keeps each entity isolated', () => {
      render(
        <>
          <Probe testId="a" entityType="agent" entityId="agent-1" />
          <Probe testId="b" entityType="workflow" entityId="agent-1" />
        </>,
      );

      act(() => screen.getByRole('button', { name: 'set-a' }).click());

      expect(screen.getByTestId('b').textContent).toBe('{}');
    });
  });

  describe('when localStorage already holds a value', () => {
    it('restores it on mount', () => {
      window.localStorage.setItem('mastra-request-context:workflow:wf-1', '{"locale":"fr"}');

      render(<Probe testId="a" entityType="workflow" entityId="wf-1" />);

      expect(screen.getByTestId('a').textContent).toBe('{"locale":"fr"}');
    });
  });
});
