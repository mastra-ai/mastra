import { auth } from '@/app/(auth)/auth';
// import { getChatsByUserId } from '@/lib/db/queries';
import { mastra } from '@/src/mastra';

export async function GET() {
  try {
    const session = await auth();
    console.log('got session====', session);
    if (!session || !session.user) {
      return Response.json('Unauthorized!', { status: 401 });
    }

    console.log('start======');

    const agent = mastra.getAgent('weatherAgent');

    console.log('agent====', agent);

    if (!agent) {
      return Response.json('Agent not found', { status: 404 });
    }

    const memory = agent.getMemory();

    if (!memory) {
      return Response.json('Memory not initialized', { status: 400 });
    }

    console.log('memory===', memory);

    const threads = await memory.getThreadsByResourceId({ resourceId: session.user.id! });
    // if (!thread) {
    //   return Response.json('Thread not found', { status: 404 });
    // }

    // biome-ignore lint: Forbidden non-null assertion.
    // const chats = await getChatsByUserId({ id: session.user.id! });

    console.log('threads===', threads);
    return Response.json(threads);
  } catch (error: any) {
    console.log(error);
    return new Response(`An error occurred while processing your request: ${error.message}`, {
      status: 500,
    });
  }
}
