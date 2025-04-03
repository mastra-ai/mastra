import { notFound } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { mastra } from '@/src/mastra';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  const session = await auth();

  const agent = mastra.getAgent('weatherAgent');

  if (!agent) {
    return notFound();
  }

  const memory = agent.getMemory();

  if (!memory) {
    return notFound();
  }

  const thread = await memory.getThreadById({ threadId: id });

  if (!thread) {
    return notFound();
  }

  const messagesFromDb = await memory.query({ threadId: id });

  console.log('messagesFromDb===', messagesFromDb);

  return (
    <>
      <Chat
        id={thread.id}
        initialMessages={messagesFromDb.uiMessages || []}
        isReadonly={session?.user?.id !== thread.resourceId}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
