// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ArrivalScope, Arriving } from './arrival';
import { useArriving } from './use-watched';
import { ARRIVING_CLASS } from '@/ds/tokens';

function Mark({ name }: { name: string }) {
  const arriving = useArriving();

  return (
    <span data-testid={name} className={arriving}>
      {name}
    </span>
  );
}

function arrives(name: string): boolean {
  return screen.getByTestId(name).classList.contains(ARRIVING_CLASS);
}

describe('arrival scope', () => {
  it('leaves what the reader was handed alone and fades what lands afterwards', () => {
    const { rerender } = render(
      <ArrivalScope>
        <Mark name="handed" />
      </ArrivalScope>,
    );

    expect(arrives('handed')).toBe(false);

    rerender(
      <ArrivalScope>
        <Mark name="handed" />
        <Mark name="later" />
      </ArrivalScope>,
    );

    expect(arrives('later')).toBe(true);
    expect(arrives('handed')).toBe(false);
  });

  it('lets a row carry its own contents in, then hands them their own entrance', () => {
    function Row({ detail }: { detail?: string }) {
      return (
        <Arriving>
          <Mark name="label" />
          {detail && <Mark name="detail" />}
        </Arriving>
      );
    }

    const { rerender } = render(
      <ArrivalScope>
        <span />
      </ArrivalScope>,
    );

    rerender(
      <ArrivalScope>
        <Row />
      </ArrivalScope>,
    );

    expect(screen.getByTestId('label').parentElement?.classList.contains(ARRIVING_CLASS)).toBe(true);
    expect(arrives('label')).toBe(false);

    rerender(
      <ArrivalScope>
        <Row detail="src/index.ts" />
      </ArrivalScope>,
    );

    expect(arrives('detail')).toBe(true);
  });
});
