import { describe, it, expect } from 'vitest';

import { detectProject } from '../../src/utils/project.js';
import { resolveProject } from '../../src/web/fs-routes.js';

/**
 * The web project picker must derive the SAME resourceId the TUI uses, so a
 * project opened in the terminal and in the web app resolve to one shared
 * session. `resolveProject` is the server-side bridge; it must agree with
 * `detectProject` (and honor the MASTRA_RESOURCE_ID override identically).
 */
describe('web project resolution (TUI parity)', () => {
  it('produces the same resourceId as detectProject for a path', () => {
    const cwd = process.cwd();
    const direct = detectProject(cwd);
    const resolved = resolveProject(cwd);
    expect(resolved.resourceId).toBe(direct.resourceId);
    expect(resolved.name).toBe(direct.name);
    expect(resolved.rootPath).toBe(direct.rootPath);
  });

  it('honors the MASTRA_RESOURCE_ID override like the TUI', () => {
    const prev = process.env.MASTRA_RESOURCE_ID;
    process.env.MASTRA_RESOURCE_ID = 'shared-team-resource';
    try {
      expect(resolveProject(process.cwd()).resourceId).toBe('shared-team-resource');
    } finally {
      if (prev === undefined) delete process.env.MASTRA_RESOURCE_ID;
      else process.env.MASTRA_RESOURCE_ID = prev;
    }
  });

  it('is deterministic — the same path always yields the same resourceId', () => {
    const a = resolveProject(process.cwd()).resourceId;
    const b = resolveProject(process.cwd()).resourceId;
    expect(a).toBe(b);
  });
});
