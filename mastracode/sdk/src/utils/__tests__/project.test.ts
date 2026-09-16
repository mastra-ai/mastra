import { describe, expect, it } from 'vitest';

import { detectProject } from '../project.js';
import type { ProjectInfo } from '../project.js';

describe('detectProject', () => {
  it('returns an asynchronous project identity with the established short SHA-256 format', async () => {
    const result: Promise<ProjectInfo> = detectProject(process.cwd());
    const project = await result;

    expect(project.resourceId).toMatch(/-[0-9a-f]{12}$/);
    expect(project.rootPath).toBeTruthy();
  });
});
