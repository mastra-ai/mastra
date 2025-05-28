import { createDataStreamResponse, appendResponseMessages } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { Agent } from '@mastra/core/agent';

const sourecTool = createTool({
  id: 'source-tool',
  description: 'Get the source of the blog post.',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => {
    return {
      source: 'https://www.google.com',
    };
  },
});

const copywriterAgent = new Agent({
  name: 'Copywriter',
  instructions: 'You are a copywriter agent that writes blog post copy, always add source',
  model: openai('gpt-4o'),
  tools: { sourecTool },
});

const editorAgent = new Agent({
  name: 'Editor',
  instructions: 'You are an editor agent that edits blog post copy.',
  model: openai('gpt-4o-mini'),
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const response = createDataStreamResponse({
      status: 200,
      statusText: 'OK',
      headers: {
        'Custom-Header': 'value',
      },
      async execute(dataStream) {
        const copywriterTool = createTool({
          id: 'copywriter-agent',
          description: 'Calls the copywriter agent to write blog post copy.',
          inputSchema: z.object({
            topic: z.string().describe('Blog post topic'),
          }),
          outputSchema: z.object({
            copy: z.string().describe('Blog post copy'),
          }),
          execute: async ({ context }) => {
            const result = await copywriterAgent.stream(`Create a blog post about ${context.topic}`, {
              onChunk: ({ chunk }) => {
                if (chunk.type === 'tool-call') {
                  dataStream.writeData(JSON.stringify(chunk));
                  dataStream.writeMessageAnnotation(JSON.stringify(chunk));
                }
              },
            });

            let copy = '';
            for await (const part of result.fullStream) {
              if (part.type === 'text-delta') {
                copy += part.textDelta;
              }
            }

            return { copy };
          },
        });

        const editorTool = createTool({
          id: 'editor-agent',
          description: 'Calls the editor agent to edit blog post copy.',
          inputSchema: z.object({
            copy: z.string().describe('Blog post copy'),
          }),
          outputSchema: z.object({
            copy: z.string().describe('Edited blog post copy'),
          }),
          execute: async ({ context }) => {
            const result = await editorAgent.generate(
              `Edit the following blog post only returning the edited copy: ${context.copy}`,
            );

            return { copy: result.text };
          },
        });

        const publisherAgent = new Agent({
          name: 'publisherAgent',
          instructions:
            'You are a publisher agent that first calls the copywriter agent to write blog post copy about a specific topic and then calls the editor agent to edit the copy. Just return the final edited copy.',
          model: openai('gpt-4o'),
          tools: { copywriterTool, editorTool },
        });

        const publisherAgentStream = await publisherAgent.stream(messages, { toolCallStreaming: true });

        publisherAgentStream.mergeIntoDataStream(dataStream);
      },
      onError: error => {
        console.error('Error in POST request:', error);
        return `Custom error: ${error}`;
      },
    });

    return response;
  } catch (error) {
    console.error('Error in POST request:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
