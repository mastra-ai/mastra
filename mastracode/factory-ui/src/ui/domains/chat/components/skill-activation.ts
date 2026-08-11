// ---------------------------------------------------------------------------
// Skill-envelope parser — pure logic, no React dependencies.
// Shared by SkillMessage.tsx (component) and unit tests.
// ---------------------------------------------------------------------------

export interface SkillActivation {
  name: string;
  instructions: string;
  arguments?: string;
}

/**
 * Pattern matching `<skill name="…">body</skill>`, anchored to the full
 * trimmed string. Mirrors the TUI regex at `render-messages.ts:616`:
 * `^<skill\s+name="([^"]*)">([\s\S]*?)<\/skill>$`
 */
const SKILL_PATTERN = /^<skill\s+name="([^"]+)">([\s\S]*?)<\/skill>$/;
const ARGUMENTS_MARKER = '\n\nARGUMENTS: ';

export function parseSkillActivation(text: string): SkillActivation | undefined {
  const match = SKILL_PATTERN.exec(text.trim());
  if (!match) return undefined;

  const name = match[1];
  if (!name) return undefined;

  // Trim a single leading/trailing newline from the body (the envelope
  // format wraps the content in `>\n{body}\n</skill>`).
  let body = match[2];
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.endsWith('\n')) body = body.slice(0, -1);

  // Unescape the boundary sentinel that `escapeSkillBoundary` inserts to
  // prevent premature envelope closure (`start-coordinator.ts:56`).
  body = body.replaceAll('&lt;/skill&gt;', '</skill>');

  if (!body.trim()) return undefined;

  // Split a trailing ARGUMENTS block from the instructions.
  const argIndex = body.lastIndexOf(ARGUMENTS_MARKER);
  const instructions = argIndex >= 0 ? body.slice(0, argIndex) : body;
  const args = argIndex >= 0 ? body.slice(argIndex + ARGUMENTS_MARKER.length).trim() : undefined;

  return { name, instructions, arguments: args || undefined };
}
