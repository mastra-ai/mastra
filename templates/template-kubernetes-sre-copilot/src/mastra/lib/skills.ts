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
 *
 * `name` is always a hardcoded literal at every call site today (`'crashloopbackoff'`,
 * `'imagepullbackoff'`, `'oomkilled'`, `'pvc-pending'`) — but it's still validated before being
 * used to build a filesystem path, not trusted implicitly. If a future change ever routes
 * user/LLM-controlled input into this parameter (e.g. a v2 feature letting callers name a custom
 * failure type), an unvalidated `name` containing `../` segments would be a straightforward path
 * traversal read primitive. The allowlist-style character check below, plus confirming the
 * resolved path still lives under the skills directory, closes that off now rather than leaving
 * it as a trap for whoever makes that later change.
 */
const SAFE_SKILL_NAME = /^[a-z0-9-]+$/;

export async function loadSkill(name: string): Promise<string> {
  if (!SAFE_SKILL_NAME.test(name)) {
    throw new Error(`Invalid skill name "${name}" — must be lowercase alphanumeric with hyphens only.`);
  }

  const skillsDir = resolve(import.meta.dirname, '../../workspace/skills');
  const path = resolve(skillsDir, name, 'SKILL.md');

  // Belt-and-suspenders: even though SAFE_SKILL_NAME already rules out "../" segments, confirm
  // the resolved path didn't escape the skills directory before reading it.
  if (!path.startsWith(skillsDir)) {
    throw new Error(`Resolved skill path for "${name}" escaped the skills directory.`);
  }

  return readFile(path, 'utf-8');
}
