import { ARRIVING_CLASS } from '@mastra/playground-ui/tokens';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ArrivalScope } from '@mastra/playground-ui/components/Arrival';
import { ToolCard } from '../tool/ToolCard';

const ToolExample = ({ running }: { running: boolean }) => (
  <ArrivalScope>
    <ToolCard
      tool={{
        toolCallId: 'read-1',
        toolName: 'read_file',
        args: { path: 'src/app.ts' },
        status: running ? 'running' : 'done',
        argsText: '',
        output: '',
        createdAt: Date.parse('2026-09-17T12:00:00Z'),
      }}
    />
  </ArrivalScope>
);

describe('ToolCard', () => {
  describe('when its run ends', () => {
    it('stays where it is rather than landing a second time', () => {
      const { rerender } = render(<ToolExample running />);
      const detail = screen.getByText('src/app.ts');

      rerender(<ToolExample running={false} />);

      expect(screen.getByText('src/app.ts')).toBe(detail);
      expect(detail.classList.contains(ARRIVING_CLASS)).toBe(false);
    });
  });
});
