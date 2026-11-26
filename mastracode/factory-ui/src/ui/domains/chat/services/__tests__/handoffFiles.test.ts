import { describe, expect, it } from 'vitest';

import type { PendingImage } from '../../context/ComposerImagesContext';
import { stashHandoffFiles, takeHandoffFiles } from '../handoffFiles';

const image: PendingImage = { id: 'pending-image-1', data: 'cG5n', mediaType: 'image/png', filename: 'shot.png' };

describe('first-prompt handoff files', () => {
  it('hands stashed images to the session they were stashed for', () => {
    stashHandoffFiles('session-a', [image]);

    expect(takeHandoffFiles('session-b')).toEqual([]);
    expect(takeHandoffFiles('session-a')).toEqual([image]);
  });

  it('hands images over only once so a remount cannot resend them', () => {
    stashHandoffFiles('session-a', [image]);

    takeHandoffFiles('session-a');

    expect(takeHandoffFiles('session-a')).toEqual([]);
  });

  it('clears earlier images when a later prompt for the session has none', () => {
    stashHandoffFiles('session-a', [image]);

    stashHandoffFiles('session-a', []);

    expect(takeHandoffFiles('session-a')).toEqual([]);
  });
});
