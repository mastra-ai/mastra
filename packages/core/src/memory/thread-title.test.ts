import { describe, expect, it } from 'vitest';
import { isThreadTitlePinned, setThreadOMMetadata, setThreadTitlePinned } from './types';

describe('thread title pin metadata', () => {
  it.each([undefined, {}, { mastra: null }, { mastra: [] }, { mastra: 'invalid' }, { mastra: {} }])(
    'treats missing or malformed metadata %j as unpinned',
    metadata => {
      expect(isThreadTitlePinned(metadata)).toBe(false);
      expect(isThreadTitlePinned(setThreadTitlePinned(metadata, true))).toBe(true);
    },
  );

  it.each([undefined, false, 'true', 1])('does not treat titlePinned=%j as an explicit pin', titlePinned => {
    expect(isThreadTitlePinned({ mastra: { titlePinned } })).toBe(false);
  });

  it('preserves other metadata and does not mutate the original when pinning or unpinning', () => {
    const metadata = { custom: 'keep', mastra: { om: { currentTask: 'Keep working' }, other: 'keep' } };
    const pinned = setThreadTitlePinned(metadata, true);
    const unpinned = setThreadTitlePinned(pinned, false);

    expect(pinned).toEqual({ ...metadata, mastra: { ...metadata.mastra, titlePinned: true } });
    expect(unpinned).toEqual({ ...metadata, mastra: { ...metadata.mastra, titlePinned: false } });
    expect(isThreadTitlePinned(pinned)).toBe(true);
    expect(isThreadTitlePinned(metadata)).toBe(false);
    expect(metadata.mastra).not.toHaveProperty('titlePinned');
    expect(pinned.mastra).not.toBe(metadata.mastra);
  });

  it('retains the pin when observational memory updates its own metadata', () => {
    const pinned = setThreadTitlePinned(undefined, true);
    const updated = setThreadOMMetadata(pinned, { threadTitle: 'Observer title' });
    expect(isThreadTitlePinned(updated)).toBe(true);
    expect(updated).toMatchObject({ mastra: { om: { threadTitle: 'Observer title' } } });
  });
});
