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

export interface SlashCommandActivation {
  name: string;
  content: string;
}

/**
 * Parse `<slash-command name="…">body</slash-command>`, anchored to the full
 * trimmed string. The body terminates at the FIRST closing tag — matching
 * `formatSlashCommandActivation`, whose escaping exists precisely so literal
 * closers inside content can never end the envelope early.
 */
const SLASH_COMMAND_OPEN = /^<slash-command\s+name="([^"]+)">/;
const CLOSING_TAG = '</slash-command>';

export function parseSlashCommandActivation(text: string): SlashCommandActivation | undefined {
  const trimmed = text.trim();
  const open = SLASH_COMMAND_OPEN.exec(trimmed);
  if (!open) return undefined;

  const name = open[1];
  if (!name) return undefined;

  const bodyStart = open[0].length;
  const bodyEnd = trimmed.indexOf(CLOSING_TAG, bodyStart);
  if (bodyEnd === -1) return undefined;
  if (trimmed.slice(bodyEnd + CLOSING_TAG.length).trim() !== '') return undefined;

  let body = trimmed.slice(bodyStart, bodyEnd);
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.endsWith('\n')) body = body.slice(0, -1);
  body = body.replaceAll('&lt;/slash-command&gt;', '</slash-command>');

  if (!body.trim()) return undefined;
  return { name, content: body };
}
