import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { SETUP_MARKER_PATH, normalizeSetupCommands, setupMarkerCommand, setupMarkerContent } from './setup-marker';

describe('setup marker', () => {
  it('digests the non-blank commands joined by newlines, in order', () => {
    const expected = `sha256:${createHash('sha256').update('pnpm i\npnpm build').digest('hex')}`;
    expect(setupMarkerContent(['pnpm i', '', '  ', 'pnpm build'])).toBe(expected);
    expect(setupMarkerContent(['pnpm build', 'pnpm i'])).not.toBe(expected);
    // A single string is a one-entry list, so factory's string and a template's array agree.
    expect(setupMarkerContent('pnpm i')).toBe(setupMarkerContent(['pnpm i']));
    expect(setupMarkerContent(undefined)).toBe(setupMarkerContent([]));
  });

  it('normalizes blank entries away without trimming the rest', () => {
    expect(normalizeSetupCommands([' pnpm i ', '', '   '])).toEqual([' pnpm i ']);
    expect(normalizeSetupCommands('pnpm i')).toEqual(['pnpm i']);
    expect(normalizeSetupCommands(undefined)).toEqual([]);
  });

  it('writes the marker beside the cwd with a shell-safe digest', () => {
    const content = setupMarkerContent('pnpm i');
    expect(content).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(setupMarkerCommand(content)).toBe(
      `mkdir -p "$(dirname "${SETUP_MARKER_PATH}")" && printf '%s' '${content}' > "${SETUP_MARKER_PATH}"`,
    );
    expect(SETUP_MARKER_PATH).toBe('.mastra-sandbox/setup');
  });
});
