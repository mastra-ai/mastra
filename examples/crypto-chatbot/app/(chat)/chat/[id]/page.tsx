import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { DEFAULT_MODEL_NAME, models } from '@/ai/models';
import { auth } from '@/app/(auth)/auth';
import { Chat as PreviewChat } from '@/components/custom/chat';
import { createMastra } from '@/mastra';

export default async function Page(props: { params: Promise<any> }) {
  const params = await props.params;
  const { id } = params;
  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;
  const selectedModel = models.find((model) => model.id === modelIdFromCookie);
  const selectedModelId = selectedModel?.id || DEFAULT_MODEL_NAME;

  const mastra = createMastra({
    modelName: selectedModelId!,
    modelProvider: selectedModel?.provider! || `OPEN_AI`,
  });

  console.log(id);
  let chat;
  try {
    chat = await mastra.memory?.getThreadById({ threadId: id });
  } catch (e) {
    console.error('Error getting chat:', e);
  }

  if (!chat) {
    notFound();
  }

  const session = await auth();

  if (!session || !session.user) {
    return notFound();
  }

  if (session.user.id !== chat.resourceId) {
    return notFound();
  }

  const memoryMessages = await mastra.memory?.query({
    threadId: id,
  });

  return (
    <PreviewChat
      id={chat.id}
      initialMessages={memoryMessages ? memoryMessages.uiMessages : []}
      selectedModelId={selectedModelId}
    />
  );
}
