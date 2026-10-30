import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

// COR-1472: a worker lost during its first tool used to leave no record of the user's request.
// Other engines keep their existing end-of-turn persistence contract.
describeForAllEngines('Durable input survives an unfinished turn', engine => {
  const getMock = useLoopScenarioAimock();
  const question = 'Where is order #4821?';
  const answer = 'Order #4821 has shipped.';
  const durable = engine === 'durable' || engine === 'evented';

  for (const method of ['stream', 'generate'] as const) {
    it.each([undefined, false, true])(
      `${method}: stores the request before the first tool, independently of savePerStep=%s`,
      async savePerStep => {
        const llm = getMock();
        const memory = new MockMemory();
        const threadId = `early-input-${method}-${savePerStep}`;
        const resourceId = 'customer-4821';
        const store = (await memory.storage.getStore('memory'))!;
        let atToolEntry: MastraDBMessage[] | undefined;
        let firstStepInput: MastraDBMessage[] | undefined;
        let toolContextMessages: unknown;
        const tools = {
          lookupOrder: createTool({
            id: 'lookupOrder',
            description: 'Look up an order.',
            inputSchema: z.object({ orderId: z.string() }),
            execute: async (_input, context) => {
              toolContextMessages = context?.agent?.messages;
              atToolEntry = (await store.listMessages({ threadId, perPage: false })).messages;
              return { status: 'shipped' };
            },
          }),
        };
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'lookup-4821', name: 'lookupOrder', arguments: { orderId: '4821' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: answer });

        const sharedAgent = await createSharedAgent(llm, {
          engine,
          memory,
          tools,
          inputProcessors: [
            {
              id: 'retain-request-context',
              processInputStep: ({ messageList, stepNumber }) => {
                if (stepNumber === 0) firstStepInput = messageList.get.input.db();
              },
            },
          ],
        });
        let text: string;
        if (method === 'generate') {
          const result = await sharedAgent.agent.generate(question, {
            memory: { thread: threadId, resource: resourceId },
            maxSteps: 3,
            ...(savePerStep === undefined ? {} : { savePerStep }),
          });
          text = result.text;
        } else {
          const { output } = await runLoopScenario({
            engine,
            llm,
            sharedAgent,
            prompt: question,
            memory,
            threadId,
            resourceId,
            maxSteps: 3,
            savePerStep,
            fixtures: () => {},
          });
          text = await output.text;
        }

        expect(text).toBe(answer);
        expect(firstStepInput, 'step processors must retain accepted input membership').toHaveLength(1);
        expect(JSON.stringify(firstStepInput![0]!.content)).toContain(question);
        expect(JSON.stringify(toolContextMessages), 'tools must receive the accepted input').toContain(question);
        expect(atToolEntry, 'the first tool must have run').toBeDefined();
        if (durable) {
          expect(atToolEntry, 'accepted input must exist before a worker can be lost in its first tool').toHaveLength(
            1,
          );
          expect(atToolEntry![0]).toMatchObject({ role: 'user', threadId, resourceId });
          expect(JSON.stringify(atToolEntry![0]!.content)).toContain(question);
        }
        const { messages } = await store.listMessages({ threadId, perPage: false });
        const users = messages.filter(message => message.role === 'user');
        expect(users).toHaveLength(1);
        expect(JSON.stringify(users[0]!.content)).toContain(question);
        expect(firstStepInput![0]!.id, 'step processors must retain the persisted request identity').toBe(users[0]!.id);
        if (durable) expect(users[0]!.id).toBe(atToolEntry![0]!.id);
        expect(JSON.stringify(messages.filter(message => message.role === 'assistant'))).toContain(answer);
        expect(JSON.stringify(llm.getRequests()[1]!.body!.messages)).toContain(question);
      },
    );

    it(`${method}: readOnly memory does not save the accepted request`, async () => {
      const llm = getMock();
      const memory = new MockMemory();
      const threadId = `readonly-input-${method}`;
      const resourceId = 'readonly-customer';
      await memory.createThread({ threadId, resourceId });
      llm.on({ endpoint: 'chat' }, { content: answer });
      const sharedAgent = await createSharedAgent(llm, { engine, memory });
      if (method === 'generate') {
        const result = await sharedAgent.agent.generate(question, {
          memory: { thread: threadId, resource: resourceId, options: { readOnly: true } },
        });
        expect(result.text).toBe(answer);
      } else {
        const { output } = await runLoopScenario({
          engine,
          llm,
          sharedAgent,
          prompt: question,
          memory,
          threadId,
          resourceId,
          memoryOptions: { readOnly: true },
          fixtures: () => {},
        });
        expect(await output.text).toBe(answer);
      }
      const { messages } = await (await memory.storage.getStore('memory'))!.listMessages({ threadId, perPage: false });
      expect(messages).toEqual([]);
    });

    it(`${method}: a rejected request never reaches the model`, async () => {
      const llm = getMock();
      const memory = new MockMemory();
      const threadId = `rejected-input-${method}`;
      const resourceId = 'rejected-customer';
      await memory.createThread({ threadId, resourceId });
      llm.on({ endpoint: 'chat' }, { content: 'This must never be generated.' });
      const sharedAgent = await createSharedAgent(llm, {
        engine,
        memory,
        inputProcessors: [
          {
            id: 'reject-request',
            processInput: async ({ abort, messages }) => {
              abort('Request rejected by policy.');
              return messages;
            },
          },
        ],
      });
      if (method === 'generate') {
        const result = await sharedAgent.agent.generate(question, {
          memory: { thread: threadId, resource: resourceId },
        });
        expect(result.text).not.toContain('This must never be generated.');
      } else {
        const { output } = await runLoopScenario({
          engine,
          llm,
          sharedAgent,
          prompt: question,
          memory,
          threadId,
          resourceId,
          fixtures: () => {},
        });
        expect(await output.text).not.toContain('This must never be generated.');
      }
      expect(llm.getRequests()).toHaveLength(0);
      const { messages } = await (await memory.storage.getStore('memory'))!.listMessages({ threadId, perPage: false });
      expect(messages).toEqual([]);
    });

    it(`${method}: persists accepted redacted input without rewriting recalled history`, async () => {
      const llm = getMock();
      const memory = new MockMemory();
      const threadId = `redacted-input-${method}`;
      const resourceId = 'redacted-customer';
      await memory.createThread({ threadId, resourceId });
      const store = (await memory.storage.getStore('memory'))!;
      await memory.saveMessages({
        messages: [
          {
            id: 'prior-request',
            threadId,
            resourceId,
            role: 'user',
            createdAt: new Date(0),
            content: { format: 2, parts: [{ type: 'text', text: 'Earlier support request' }] },
          },
        ],
      });
      const seeded = (await store.listMessages({ threadId, perPage: false })).messages[0]!;
      const savedIds: string[] = [];
      const save = store.saveMessages.bind(store);
      const observeSave = vi.spyOn(store, 'saveMessages').mockImplementation(async args => {
        const result = await save(args);
        savedIds.push(...args.messages.map(message => message.id));
        return result;
      });
      llm.on({ endpoint: 'chat' }, { content: answer });
      const sharedAgent = await createSharedAgent(llm, {
        engine,
        memory,
        inputProcessors: [
          {
            id: 'redact-secret',
            processInput: ({ messages }) =>
              messages.map(message => ({
                ...message,
                content: {
                  ...message.content,
                  content: message.content.content?.replace('PRIVATE_TOKEN', '[REDACTED]'),
                  parts: message.content.parts.map(part =>
                    part.type === 'text' ? { ...part, text: part.text.replace('PRIVATE_TOKEN', '[REDACTED]') } : part,
                  ),
                },
              })),
          },
        ],
      });
      try {
        if (method === 'stream') {
          const { output } = await runLoopScenario({
            engine,
            llm,
            sharedAgent,
            memory,
            threadId,
            resourceId,
            prompt: 'My secret is PRIVATE_TOKEN',
            fixtures: () => {},
          });
          expect(await output.text).toBe(answer);
        } else {
          const result = await sharedAgent.agent.generate('My secret is PRIVATE_TOKEN', {
            memory: { thread: threadId, resource: resourceId },
          });
          expect(result.text).toBe(answer);
        }
        const stored = (await store.listMessages({ threadId, perPage: false })).messages;
        const current = stored.filter(message => message.role === 'user' && message.id !== seeded.id);
        expect(current).toHaveLength(1);
        expect(JSON.stringify(current)).toContain('[REDACTED]');
        expect(JSON.stringify(current)).not.toContain('PRIVATE_TOKEN');
        expect(JSON.stringify(llm.getRequests()[0]!.body!.messages)).toContain('[REDACTED]');
        expect(JSON.stringify(llm.getRequests()[0]!.body!.messages)).not.toContain('PRIVATE_TOKEN');
        expect(stored.find(message => message.id === seeded.id)).toEqual(seeded);
        expect(savedIds).not.toContain(seeded.id);
      } finally {
        observeSave.mockRestore();
      }
    });

    if (durable) {
      it(`${method}: a failed initial save surfaces an error before the model runs`, async () => {
        const llm = getMock();
        const memory = new MockMemory();
        const threadId = `unavailable-input-${method}`;
        const resourceId = 'unavailable-customer';
        await memory.createThread({ threadId, resourceId });
        const store = (await memory.storage.getStore('memory'))!;
        const failingSave = vi
          .spyOn(store, 'saveMessages')
          .mockRejectedValue(new Error('INITIAL_INPUT_STORAGE_UNAVAILABLE'));
        llm.on({ endpoint: 'chat' }, { content: 'This must never be generated.' });
        const sharedAgent = await createSharedAgent(llm, { engine, memory });
        try {
          if (method === 'generate') {
            await expect(
              sharedAgent.agent.generate(question, {
                memory: { thread: threadId, resource: resourceId },
              }),
            ).rejects.toThrow('INITIAL_INPUT_STORAGE_UNAVAILABLE');
          } else {
            const result = await sharedAgent.agent.stream(question, {
              memory: { thread: threadId, resource: resourceId },
            });
            const chunks = [];
            for await (const chunk of result.fullStream) chunks.push(chunk);
            expect(JSON.stringify(chunks.filter(chunk => chunk.type === 'error'))).toContain(
              'INITIAL_INPUT_STORAGE_UNAVAILABLE',
            );
          }
          expect(llm.getRequests()).toHaveLength(0);
          expect((await store.listMessages({ threadId, perPage: false })).messages).toEqual([]);
        } finally {
          failingSave.mockRestore();
        }
      });

      it(`${method}: an input processor exception leaves no accepted input`, async () => {
        const llm = getMock();
        const memory = new MockMemory();
        const threadId = `throwing-input-${method}`;
        const resourceId = 'throwing-customer';
        await memory.createThread({ threadId, resourceId });
        const sharedAgent = await createSharedAgent(llm, {
          engine,
          memory,
          inputProcessors: [
            {
              id: 'failed-request-validation',
              processInput: () => {
                throw new Error('REQUEST_VALIDATION_UNAVAILABLE');
              },
            },
          ],
        });
        await expect(
          sharedAgent.agent[method](question, {
            memory: { thread: threadId, resource: resourceId },
          }),
        ).rejects.toThrow();
        expect(llm.getRequests()).toHaveLength(0);
        expect(
          (await (await memory.storage.getStore('memory'))!.listMessages({ threadId, perPage: false })).messages,
        ).toEqual([]);
      });
    }

    it(`${method}: still answers without memory`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: answer });
      const sharedAgent = await createSharedAgent(llm, { engine });
      if (method === 'generate') {
        expect((await sharedAgent.agent.generate(question)).text).toBe(answer);
      } else {
        const { output } = await runLoopScenario({
          engine,
          llm,
          sharedAgent,
          prompt: question,
          fixtures: () => {},
        });
        expect(await output.text).toBe(answer);
      }
    });
  }
});
