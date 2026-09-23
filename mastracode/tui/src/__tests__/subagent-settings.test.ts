import { describe, expect, it } from 'vitest';

import { resolveTuiSubagents } from '../subagent-settings.js';

describe('resolveTuiSubagents', () => {
  it('disables SDK default subagents unless the TUI preference is enabled', () => {
    expect(resolveTuiSubagents(false)).toEqual([]);
  });

  it('allows the SDK to register native defaults after opt-in', () => {
    expect(resolveTuiSubagents(true)).toBeUndefined();
  });
});
