import { openai } from '@ai-sdk/openai';
import { describe, it } from 'vitest';
import {
  createStep,
  createWorkflow,
  type CoreMessage,
  type MemoryConfig,
  type MessageType,
  type StorageGetMessagesArg,
  type StorageThreadType,
} from '../../';
import type { AiMessageType } from '../../agent';
import { Agent } from '../../agent';
import { MastraMemory } from '../../memory';
import { RuntimeContext } from '../../runtime-context';
import { NewAgentNetwork } from './index';
import { z } from 'zod';

class MockMemory extends MastraMemory {
  #byResourceId: Map<string, any[]> = new Map();
  #byThreadId: Map<string, any[]> = new Map();

  constructor(config: { name: string }) {
    super({
      name: config.name,
      options: {
        lastMessages: 10,
      },
    });
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }) {
    // console.log('MEM getThreadsByResourceId', resourceId, this.#byResourceId.get(resourceId));
    return this.#byResourceId.get(resourceId) || [];
  }

  async getThreadById({ threadId }: { threadId: string }) {
    // console.log('MEM getThreadById', threadId, this.#byThreadId.get(threadId));
    return {
      id: threadId,
      resourceId: 'test-resource',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: this.#byThreadId.get(threadId) || [],
    };
  }

  async saveMessages({ messages }: { messages: MessageType[] }) {
    // console.log('MEM saveMessages', messages);
    for (const message of messages) {
      const thread = this.#byThreadId.get(message.threadId) ?? [];
      thread.push(message);
      this.#byThreadId.set(message.threadId, thread);

      if (message.resourceId) {
        const resource = this.#byResourceId.get(message.resourceId) ?? [];
        resource.push(message);
        this.#byResourceId.set(message.resourceId, resource);
      }
    }
    return messages;
  }

  async rememberMessages({
    threadId,
    resourceId,
    vectorMessageSearch,
    systemMessage,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    systemMessage?: CoreMessage;
    config?: MemoryConfig;
  }): Promise<{
    threadId: string;
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }> {
    // console.log('MEM rememberMessages', threadId, resourceId, vectorMessageSearch, systemMessage, config);
    const thread = this.#byThreadId.get(threadId) ?? [];
    thread.push(systemMessage);
    this.#byThreadId.set(threadId, thread);

    if (resourceId) {
      const resource = this.#byResourceId.get(resourceId) ?? [];
      resource.push(systemMessage);
      this.#byResourceId.set(resourceId, resource);
    }

    return {
      threadId,
      messages: thread,
      uiMessages: thread.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
    };
  }

  async query({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<{ messages: CoreMessage[]; uiMessages: AiMessageType[] }> {
    // console.log('MEM query', threadId, resourceId, selectBy);
    const thread = this.#byThreadId.get(threadId) ?? [];
    return {
      messages: thread,
      uiMessages: thread.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
    };
  }

  async saveThread({ thread }: { thread: StorageThreadType }) {
    // console.log('MEM saveThread', thread);
    this.#byThreadId.set(thread.id, []);
    return thread;
  }

  async deleteThread(threadId: string) {
    // console.log('MEM deleteThread', threadId);
    this.#byThreadId.delete(threadId);
  }
}

describe('NewAgentNetwork', () => {
  it('should create a new agent network', async () => {
    const memory = new MockMemory({
      name: 'test-memory',
    });

    const agentStep = createStep({
      id: 'agent-step',
      description: 'This step is used to do research and text synthesis.',
      inputSchema: z.object({
        task: z.string(),
      }),
      outputSchema: z.object({
        text: z.string(),
      }),
      execute: async () => {
        return {
          text: 'Avignon is the best city in France. ABSOLUTELY THE BEST',
        };
      },
    });

    const workflow1 = createWorkflow({
      id: 'workflow1',
      description:
        'This workflow includes crucial research information for any research task, but is not complete by itself. This information is only partial, while crucial to the final research.',
      steps: [],
      inputSchema: z.object({
        task: z.string(),
      }),
      outputSchema: z.object({
        text: z.string(),
      }),
    })
      .then(agentStep)
      .commit();

    const agent1 = new Agent({
      name: 'agent1',
      instructions:
        'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
      description:
        'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
      model: openai('gpt-4o'),
    });

    const agent2 = new Agent({
      name: 'agent2',
      description:
        'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report. You write articles.',
      instructions:
        'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report. You write articles. [IMPORTANT] Make sure to mention information that has been highlighted as relevant in message history.',
      model: openai('gpt-4o'),
    });

    const network = new NewAgentNetwork({
      id: 'test-network',
      name: 'Test Network',
      instructions:
        'You are a network of writers and researchers. The user will ask you to research a topic. You always need to answer with a full report. Bullet points are NOT a full report. WRITE FULL PARAGRAPHS like this is a blog post or something similar. You should not rely on partial information.',
      model: openai('gpt-4o'),
      agents: {
        agent1,
        agent2,
      },
      workflows: {
        workflow1,
      },
      memory: memory,
    });

    const runtimeContext = new RuntimeContext();

    console.log(
      await network.generate('What are the biggest cities in France? How are they like?', { runtimeContext }),
    );
  });
}, 120e3);
