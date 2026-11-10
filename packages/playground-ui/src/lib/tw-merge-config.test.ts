import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('twMerge config', () => {
  it('keeps the later scrollbar-inset step, so a smaller popup radius overrides the default', () => {
    expect(cn('rounded-xl scrollbar-inset-xl', 'rounded-md scrollbar-inset-md')).toBe('rounded-md scrollbar-inset-md');
  });

  it('treats an arbitrary scrollbar inset as the same group', () => {
    expect(cn('scrollbar-inset-xl', 'scrollbar-inset-[22px]')).toBe('scrollbar-inset-[22px]');
  });
});
