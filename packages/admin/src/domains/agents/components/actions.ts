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
    console.log('executor', result);
    //console.log('executor', JSON.stringify(result, null, 2))
    return {
      id: messageId,
      display: result?.text,
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

    return {
      id: messageId,
      display: run?.content?.[0]?.text?.value || run?.message,
      threadId: tId,
    };
  }
}
