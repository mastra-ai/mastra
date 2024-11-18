'use server';

import { mastra } from '@/mastra';

export async function testText(messages: string[]) {
  const agent = mastra.getAgent('Agent One');
  console.log({ messages });

  const streamResult = await agent?.text({
    messages,
    onStepFinish: step => {
      console.log({ step });
    },
  });

  console.log({ streamResult: JSON.stringify(streamResult) });

  return streamResult?.text;
}
