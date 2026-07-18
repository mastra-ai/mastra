import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Loads a workspace runbook's SKILL.md content by name (e.g. "crashloopbackoff"). The diagnosis
 * workflow's "classify cause" step for each failure type reads from the matching file here
 * instead of a hardcoded prompt — edit `workspace/skills/<name>/SKILL.md` and the workflow's
 * output changes accordingly, no code change required.
 *
 * IMPORTANT: `mastra dev`/`mastra build` bundle all source into a single file at
 * `.mastra/output/index.mjs`, two directories deep from the project root. `import.meta.dirname`
 * inside that bundle reflects the bundle's own location, not this file's original path under
 * `src/mastra/lib/` — so the relative path here must match `index.ts`'s `../../workspace` depth
 * (2 levels up from the bundle), not this file's original 3-levels-deep source location.
 */
export async function loadSkill(name: string): Promise<string> {
  const path = resolve(import.meta.dirname, '../../workspace/skills', name, 'SKILL.md');
  return readFile(path, 'utf-8');
}
