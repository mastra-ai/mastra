import { BaseTestCase } from './base';
import { LLMTestCase } from './llm';

export interface ConversationalTestCaseInit {
  turns: LLMTestCase[];
  chatbotRole?: string;
  name?: string;
  additionalMetadata?: Record<string, any>;
  comments?: string;
}

export class ConversationalTestCase extends BaseTestCase {
  turns: LLMTestCase[];
  chatbotRole?: string;
  name?: string;
  additionalMetadata?: Record<string, any>;
  comments?: string;

  constructor({ turns, chatbotRole, name, additionalMetadata, comments }: ConversationalTestCaseInit) {
    super();
    if (!turns || turns.length === 0) {
      throw new TypeError("'turns' must not be empty");
    }

    // Validate and deep copy turns
    const copiedTurns: LLMTestCase[] = [];
    for (const turn of turns) {
      if (!(turn instanceof LLMTestCase)) {
        throw new TypeError("'turns' must be a list of `LLMTestCases`");
      }
      // Create a deep copy of the turn
      copiedTurns.push(structuredClone(turn));
    }

    this.turns = copiedTurns;
    this.chatbotRole = chatbotRole;
    this.name = name;
    this.additionalMetadata = additionalMetadata;
    this.comments = comments;
  }
}
