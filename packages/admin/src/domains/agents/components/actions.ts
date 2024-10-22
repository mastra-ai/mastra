'use server';

import { framework } from '@/lib/framework-utils';

export async function sendAgentMessage({
  messageId,
  message,
  assistant,
}: {
  messageId: string;
  message: string;
  assistant: string;
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
    const thread = await executor.initializeThread([{ role: 'user', content: message }]);

    const run = await executor.watchRun({ threadId: thread.id });

    return {
      id: messageId,
      display: run?.content?.[0]?.text?.value,
    };
  }
}
