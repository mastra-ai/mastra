import { describe, expect, it } from 'vitest';
import { getCurrentStepContent } from './index';

const textPart = (text: string) => ({ type: 'text' as const, text });
const toolCallPart = (toolCallId: string) => ({
  type: 'tool-call' as const,
  toolCallId,
  toolName: 'lookup',
  input: { toolCallId },
});
const toolResultPart = (toolCallId: string) => ({
  type: 'tool-result' as const,
  toolCallId,
  toolName: 'lookup',
  input: { toolCallId },
  output: { ok: true },
});

type TestMessage = {
  content: Array<ReturnType<typeof textPart> | ReturnType<typeof toolCallPart> | ReturnType<typeof toolResultPart>>;
};

function oldCurrentStepContent(messages: TestMessage[], previousContentLength: number) {
  const allContent = messages.flatMap(message => message.content);
  return {
    content: allContent.slice(previousContentLength),
    nextContentLength: allContent.length,
  };
}

describe('getCurrentStepContent', () => {
  it('returns all content on the first pass and stores a cursor at the last message content offset', () => {
    const result = getCurrentStepContent(
      [{ content: [textPart('first')] }, { content: [textPart('second'), textPart('third')] }],
      { messageIndex: 0, contentOffset: 0 },
    );

    expect(result.content).toEqual([textPart('first'), textPart('second'), textPart('third')]);
    expect(result.cursor).toEqual({ messageIndex: 1, contentOffset: 2 });
  });

  it('returns content appended to the previous last message and full content from new messages', () => {
    const result = getCurrentStepContent(
      [
        { content: [textPart('old')] },
        { content: [textPart('seen'), textPart('appended')] },
        { content: [textPart('new-message')] },
      ],
      { messageIndex: 1, contentOffset: 1 },
    );

    expect(result.content).toEqual([textPart('appended'), textPart('new-message')]);
    expect(result.cursor).toEqual({ messageIndex: 2, contentOffset: 1 });
  });

  it('does not read messages before the previous cursor', () => {
    const result = getCurrentStepContent(
      [
        {
          get content(): unknown {
            throw new Error('old message should not be read');
          },
        },
        { content: [textPart('seen'), textPart('appended')] },
        { content: [textPart('new-message')] },
      ],
      { messageIndex: 1, contentOffset: 1 },
    );

    expect(result.content).toEqual([textPart('appended'), textPart('new-message')]);
  });

  it('returns no content and preserves the cursor position when no new content was added', () => {
    const result = getCurrentStepContent([{ content: [textPart('seen')] }], { messageIndex: 0, contentOffset: 1 });

    expect(result.content).toEqual([]);
    expect(result.cursor).toEqual({ messageIndex: 0, contentOffset: 1 });
  });

  it('matches the old flatMap and slice behavior across tail-growth loop iterations', () => {
    const messages: TestMessage[] = [];
    let previousContentLength = 0;
    let cursor = { messageIndex: 0, contentOffset: 0 };

    for (let iteration = 0; iteration < 200; iteration++) {
      switch (iteration % 5) {
        case 0:
          messages.push({ content: [textPart(`assistant-${iteration}`), toolCallPart(`call-${iteration}`)] });
          messages.push({ content: [toolResultPart(`call-${iteration}`)] });
          break;
        case 1:
          messages[messages.length - 1]!.content.push(textPart(`tail-append-${iteration}`));
          break;
        case 2:
          break;
        case 3:
          messages.push({ content: [textPart(`new-message-${iteration}`)] });
          break;
        case 4:
          messages[messages.length - 1]!.content.push(textPart(`tail-before-new-${iteration}`));
          messages.push({ content: [toolResultPart(`new-result-${iteration}`)] });
          break;
      }

      const oldResult = oldCurrentStepContent(messages, previousContentLength);
      const newResult = getCurrentStepContent(messages, cursor);

      expect(newResult.content, `iteration ${iteration}`).toEqual(oldResult.content);

      previousContentLength = oldResult.nextContentLength;
      cursor = newResult.cursor;
    }
  });
});
