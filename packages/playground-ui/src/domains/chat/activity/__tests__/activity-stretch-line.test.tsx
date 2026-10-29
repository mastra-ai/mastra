// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ActivityStretchLine } from '../activity-stretch-line';
import type { ActivityMember } from '../model/activity-members';

const call = (key: string, path: string): ActivityMember => ({
  kind: 'call',
  key,
  toolName: 'view',
  args: { path },
  status: 'done',
  row: <p>Row for {path}</p>,
});
const thought: ActivityMember = { kind: 'thought', key: 'thought', content: { text: 'Both files agree.' } };

afterEach(cleanup);

describe('ActivityStretchLine without a disclosure provider', () => {
  it('keeps the calls the reader opened open when a thought joins them', () => {
    const calls = [call('a', 'a.ts'), call('b', 'b.ts')];
    const { rerender } = render(<ActivityStretchLine members={calls} live={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Read files/ }));
    expect(screen.getByText('Row for a.ts')).toBeTruthy();

    rerender(<ActivityStretchLine members={[...calls, thought]} live={false} />);

    expect(screen.getByText('Both files agree.')).toBeTruthy();
    expect(screen.getByText('Row for a.ts')).toBeTruthy();
  });
});
