'use server';

import { framework } from '@/lib/framework-utils';

export async function sendAgentMessage({
  messageId,
  message,
  assistant,
  threadId,
}: {
  messageId: string;
  message: string;
  assistant: string;
  threadId: string;
}) {
  console.log(message, assistant);

  const executor = await framework?.getAgent({
    agentId: assistant,
    connectionId: 'SYSTEM',
  });

  console.log('executor', executor);

  if (!executor) {
    throw new Error('Could not create agent executor');
  }

  if (typeof executor === 'function') {
    const result = await executor({ prompt: message });

    let answer: any;

    if (Array.isArray(result.toolCalls)) {
      answer = result.toolCalls?.find(({ toolName }) => toolName === 'answer');
    }

    const text = result?.text;
    answer = JSON.stringify(answer?.args, null, 2);

    return {
      id: messageId,
      display: [text, answer],
    };
  } else {
    let tId = threadId;
    if (!tId) {
      const thread = await executor.initializeThread([{ role: 'user', content: message }]);
      tId = thread.id;
    } else {
      await executor.createUserMessage({ threadId, content: message });
    }

    const run = await executor.watchRun({ threadId: tId });

    const text = run?.content?.[0]?.text?.value || run?.message;
    const answer = JSON.stringify(run?.content?.find((m: any) => m.toolName === 'answer').args, null, 2);

    return {
      id: messageId,
      display: [text, answer],
      threadId: tId,
    };
  }
}
