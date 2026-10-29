import type { ProcessInputStepArgs, Processor } from '../processors';

export interface KnowledgeInstructionParts {
  read: string;
  write: string;
  pins: string;
}

/** `false` adds no block; a string replaces it; a function receives each enabled part ('' when disabled) and must be deterministic. */
export type KnowledgeInstructionsOption = false | string | ((parts: KnowledgeInstructionParts) => string);

export const KNOWLEDGE_READ_INSTRUCTIONS = `Use the Knowledge tools for durable, shared knowledge. Search with knowledge_search before answering from Knowledge, and read a page with knowledge_read before relying on it. Cite the page or note you used. When nothing is found, say so plainly instead of guessing. When notes disagree, show both with their dates.`;

export const KNOWLEDGE_WRITE_INSTRUCTIONS = `When you write to Knowledge, add one durable fact per note with knowledge_note, on the page it is about. Add notes to an existing page before creating a new one. Put long-form text such as specs and runbooks in a page body with knowledge_page. Record a change as a new dated note rather than rewriting an old one, and remove only notes that are wrong.`;

export const KNOWLEDGE_PINS_INSTRUCTIONS = `Maintain pinned pages with knowledge_pin (op pin or unpin). Pinned pages are delivered to the main agent on every turn, so they cost tokens permanently and must stay short. Pin only knowledge that should apply without being asked for, such as standing instructions, durable preferences, and hard constraints. Pin only knowledge that is BOTH costly to rediscover AND not the kind of thing a future agent would think to search for; anything a reminder can surface on demand does not belong in the pin set. Unpin a page as soon as it stops being unconditionally true.`;

export function buildKnowledgeInstructions(
  groups: { read: boolean; write: boolean; pins: boolean },
  option?: KnowledgeInstructionsOption,
): string {
  if (option === false) return '';
  if (typeof option === 'string') return option;
  const parts: KnowledgeInstructionParts = {
    read: groups.read ? KNOWLEDGE_READ_INSTRUCTIONS : '',
    write: groups.write ? KNOWLEDGE_WRITE_INSTRUCTIONS : '',
    pins: groups.pins ? KNOWLEDGE_PINS_INSTRUCTIONS : '',
  };
  if (option) return option(parts);
  return [parts.read, parts.write, parts.pins].filter(Boolean).join('\n\n');
}

export const KNOWLEDGE_INSTRUCTIONS_PROCESSOR_ID = 'knowledge-instructions-processor' as const;

/** Adds Knowledge's fixed usage block as a system message. The text depends only on configuration, so it is prompt-cacheable. */
export class KnowledgeInstructionsProcessor implements Processor<typeof KNOWLEDGE_INSTRUCTIONS_PROCESSOR_ID> {
  readonly id = KNOWLEDGE_INSTRUCTIONS_PROCESSOR_ID;
  readonly name = 'Knowledge Instructions Processor';

  constructor(private readonly instructions: string) {}

  processInputStep({ messageList }: ProcessInputStepArgs) {
    if (this.instructions) messageList.addSystem({ role: 'system', content: this.instructions });
    return { messageList };
  }
}
