import { describe, expect, it } from 'vitest';

import { parseBackgroundToolTaskId } from './background-tool-result.js';

describe('parseBackgroundToolTaskId', () => {
  it('parses placeholders with or without trailing detail', () => {
    expect(parseBackgroundToolTaskId('Background task started. Task ID: task-1')).toBe('task-1');
    expect(
      parseBackgroundToolTaskId(
        'Background task started. Task ID: task-2. The tool "view" is running in the background.',
      ),
    ).toBe('task-2');
  });

  it('ignores non-placeholder results', () => {
    expect(parseBackgroundToolTaskId('Done')).toBeUndefined();
  });
});
