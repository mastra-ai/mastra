import { auth } from '@/app/(auth)/auth';
import { mastra } from '@/src/mastra';

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return Response.json('Unauthorized!', { status: 401 });
    }

    const agent = mastra.getAgent('weatherAgent');

    if (!agent) {
      return Response.json('Agent not found', { status: 404 });
    }

    const memory = agent.getMemory();

    if (!memory) {
      return Response.json('Memory not initialized', { status: 400 });
    }

    const threads = await memory.getThreadsByResourceId({ resourceId: session.user.id! });

    return Response.json(threads);
  } catch (error: any) {
    console.log(error);
    return new Response(`An error occurred while processing your request: ${error.message}`, {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response('Not Found', { status: 404 });
    }

    const session = await auth();

    if (!session || !session.user) {
      return new Response('Unauthorized', { status: 401 });
    }
    const agent = mastra.getAgent('weatherAgent');

    if (!agent) {
      return Response.json('Agent not found', { status: 404 });
    }

    const memory = agent.getMemory();

    if (!memory) {
      return Response.json('Memory not initialized', { status: 400 });
    }

    const thread = await memory.getThreadById({ threadId: id });

    if (!thread) {
      return Response.json('Thread not found', { status: 404 });
    }

    if (thread.resourceId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await memory.deleteThread(id);

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
