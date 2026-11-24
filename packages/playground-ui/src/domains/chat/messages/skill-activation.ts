const WORK_ITEM_DESCRIPTION_TAG = 'work-item-description';

export interface SkillActivation {
  name: string;
  instructions: string;
  arguments?: string;
  /** The work-item description appended after the envelope, shown as context. */
  description?: string;
}

/**
 * Pattern matching `<skill name="…">body</skill>`, anchored to the start of the
 * trimmed string. Only the work-item description may trail the envelope; anything else
 * trailing keeps the message raw.
 */
const SKILL_PATTERN = /^<skill\s+name="([^"]+)">([\s\S]*?)<\/skill>\s*([\s\S]*)$/;
const DESCRIPTION_BLOCK_PATTERN = new RegExp(
  `^<${WORK_ITEM_DESCRIPTION_TAG}>\\s*([\\s\\S]*?)\\s*</${WORK_ITEM_DESCRIPTION_TAG}>$`,
);
const ARGUMENTS_MARKER = '\n\nARGUMENTS: ';

export function parseSkillActivation(text: string): SkillActivation | undefined {
  const match = SKILL_PATTERN.exec(text.trim());
  if (!match) return undefined;

  const [, name, rawBody = '', rawTrailing = ''] = match;
  const trailing = rawTrailing.trim();
  const descriptionBlock = trailing ? DESCRIPTION_BLOCK_PATTERN.exec(trailing) : undefined;
  if (trailing && !descriptionBlock) return undefined;

  if (!name) return undefined;

  // The envelope wraps the content in `>\n{body}\n</skill>`.
  let body = rawBody;
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.endsWith('\n')) body = body.slice(0, -1);

  // Unescape the boundary sentinel inserted to prevent premature envelope closure.
  body = body.replaceAll('&lt;/skill&gt;', '</skill>');

  return splitSkillBody(name, body, descriptionBlock?.[1]);
}

const TRAILING_DESCRIPTION_PATTERN = new RegExp(
  `\\n\\n<${WORK_ITEM_DESCRIPTION_TAG}>\\s*([\\s\\S]*?)\\s*</${WORK_ITEM_DESCRIPTION_TAG}>$`,
);

/**
 * Parses the contents of a typed `skill` signal (the skill name travels as a signal
 * attribute, so there is no envelope). A trailing work-item description is split out.
 */
export function parseSkillBody(name: string, text: string): SkillActivation | undefined {
  if (!name) return undefined;
  const trimmed = text.trim();
  const descriptionMatch = TRAILING_DESCRIPTION_PATTERN.exec(trimmed);
  const body = descriptionMatch ? trimmed.slice(0, descriptionMatch.index) : trimmed;
  return splitSkillBody(name, body, descriptionMatch?.[1]);
}

/**
 * Parses a skill as the model sees it in a user message: the legacy envelope (description trailing it) or
 * a typed skill signal rendered as `<skill name="…">contents</skill>`, whose contents may end
 * with the work-item description.
 */
export function parseSkillMarkup(text: string): SkillActivation | undefined {
  const activation = parseSkillActivation(text);
  if (!activation || activation.description !== undefined) return activation;
  const body = activation.arguments
    ? `${activation.instructions}${ARGUMENTS_MARKER}${activation.arguments}`
    : activation.instructions;
  return parseSkillBody(activation.name, body);
}

function splitSkillBody(name: string, body: string, description: string | undefined): SkillActivation | undefined {
  if (!body.trim()) return undefined;

  const argIndex = body.lastIndexOf(ARGUMENTS_MARKER);
  const instructions = argIndex >= 0 ? body.slice(0, argIndex) : body;
  const args = argIndex >= 0 ? body.slice(argIndex + ARGUMENTS_MARKER.length).trim() : undefined;

  return { name, instructions, arguments: args || undefined, ...(description !== undefined ? { description } : {}) };
}
