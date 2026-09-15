import { describe, expect, it } from 'vitest';

import { SETUP_MARKER_PATH, normalizeSetupCommands, setupMarkerCommand, setupMarkerContent } from './setup-marker';

describe('setup marker', () => {
  it('digests the non-blank commands joined by newlines, in order', async () => {
    const expected = 'sha256:c4f510fc071dc01b87cd45269381ce455adcbef28432d3055dfd23e3d78cdc7a';
    await expect(setupMarkerContent(['pnpm i', '', '  ', 'pnpm build'])).resolves.toBe(expected);
    await expect(setupMarkerContent(['pnpm build', 'pnpm i'])).resolves.not.toBe(expected);
    // A single string is a one-entry list, so factory's string and a template's array agree.
    await expect(setupMarkerContent('pnpm i')).resolves.toBe(await setupMarkerContent(['pnpm i']));
    await expect(setupMarkerContent(undefined)).resolves.toBe(await setupMarkerContent([]));
  });

  it('normalizes blank entries away without trimming the rest', () => {
    expect(normalizeSetupCommands([' pnpm i ', '', '   '])).toEqual([' pnpm i ']);
    expect(normalizeSetupCommands('pnpm i')).toEqual(['pnpm i']);
    expect(normalizeSetupCommands(undefined)).toEqual([]);
  });

  it('writes the marker beside the cwd with a shell-safe digest', async () => {
    const content = await setupMarkerContent('pnpm i');
    expect(content).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(setupMarkerCommand(content)).toBe(
      `mkdir -p "$(dirname "${SETUP_MARKER_PATH}")" && printf '%s' '${content}' > "${SETUP_MARKER_PATH}"`,
    );
    expect(SETUP_MARKER_PATH).toBe('.mastra-sandbox/setup');
  });
});
