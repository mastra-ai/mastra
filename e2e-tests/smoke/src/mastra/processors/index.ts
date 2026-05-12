import type { Processor, ProcessInputArgs, ProcessOutputResultArgs } from '@mastra/core/processors';

function isTextPart(part: { type: string }): part is { type: 'text'; text: string } {
  return part.type === 'text';
}

/**
 * A simple processor that uppercases all text parts in messages.
 * Implements processInput phase only.
 */
export const uppercaseProcessor: Processor<'uppercase'> = {
  id: 'uppercase',
  name: 'Uppercase Processor',
  description: 'Uppercases all text content in messages',

  processInput(args: ProcessInputArgs) {
    return args.messages.map(message => ({
      ...message,
      content: {
        ...message.content,
        parts: (message.content.parts ?? []).map(part => {
          if (isTextPart(part)) {
            return { ...part, text: part.text.toUpperCase() };
          }
          return part;
        }),
      },
    }));
  },
};

/**
 * A processor that appends a suffix to all text parts.
 * Implements both processInput and processOutputResult phases.
 */
export const suffixProcessor: Processor<'suffix'> = {
  id: 'suffix',
  name: 'Suffix Processor',
  description: 'Appends [processed] suffix to text content',

  processInput(args: ProcessInputArgs) {
    return args.messages.map(message => ({
      ...message,
      content: {
        ...message.content,
        parts: (message.content.parts ?? []).map(part => {
          if (isTextPart(part)) {
            return { ...part, text: `${part.text} [processed]` };
          }
          return part;
        }),
      },
    }));
  },

  processOutputResult(args: ProcessOutputResultArgs) {
    return args.messages.map(message => ({
      ...message,
      content: {
        ...message.content,
        parts: (message.content.parts ?? []).map(part => {
          if (isTextPart(part)) {
            return { ...part, text: `${part.text} [output-processed]` };
          }
          return part;
        }),
      },
    }));
  },
};

/**
 * A processor that aborts with a tripwire when it detects "BLOCK" in message text.
 */
export const tripwireProcessor: Processor<'tripwire-test'> = {
  id: 'tripwire-test',
  name: 'Tripwire Test Processor',
  description: 'Aborts with tripwire when message contains BLOCK',

  processInput(args: ProcessInputArgs) {
    for (const message of args.messages) {
      for (const part of message.content.parts ?? []) {
        if (isTextPart(part) && part.text.includes('BLOCK')) {
          args.abort('Content blocked by policy', { metadata: { trigger: 'BLOCK' } });
        }
      }
    }
    return args.messages;
  },
};
