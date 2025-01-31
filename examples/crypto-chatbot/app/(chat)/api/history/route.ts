import { DEFAULT_MODEL_NAME, models } from '@/ai/models';
import { auth } from '@/app/(auth)/auth';
import { createMastra } from '@/mastra';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await auth();

  if (!session || !session.user) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  const cookieStore = await cookies();

  const modelIdFromCookie = cookieStore.get('model-id')?.value;

  const selectedModel = models.find((model) => model.id === modelIdFromCookie);

  const selectedModelId = selectedModel?.id || DEFAULT_MODEL_NAME;

  const mastra = createMastra({
    modelName: selectedModelId!,
    modelProvider: selectedModel?.provider || `OPEN_AI`,
  });

  const chats = await mastra.memory?.getThreadsByResourceId({
    resourceId: session.user.id!,
  });

  return Response.json(chats || []);
}
