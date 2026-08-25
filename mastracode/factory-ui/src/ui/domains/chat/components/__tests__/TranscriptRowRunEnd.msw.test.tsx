import { ARRIVING_CLASS } from '@mastra/playground-ui/tokens';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ArrivalScope } from '@mastra/playground-ui/components/Arrival';
import { TranscriptRow } from '../TranscriptRow';

const row = (running: boolean) => (
  <ArrivalScope>
    <TranscriptRow label="Read" detail="src/app.ts" running={running} />
  </ArrivalScope>
);

describe('a row whose run ends', () => {
  it('stays where it is rather than landing a second time', () => {
    const { rerender } = render(row(true));
    const detail = screen.getByText('src/app.ts');

    rerender(row(false));

    expect(screen.getByText('src/app.ts')).toBe(detail);
    expect(detail.classList.contains(ARRIVING_CLASS)).toBe(false);
  });
});
