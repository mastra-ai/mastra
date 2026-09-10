import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import { createStep, createWorkflow } from '../workflows';
import { ProcessorRunner } from './runner';
import { ProcessorStepSchema } from './step-schema';
import type { OutputProcessorOrWorkflow } from './index';

describe('final processor text mirrors', () => {
  describe.each(['direct', 'workflow-step'] as const)('%s', path => {
    it.each(['array', 'same-list', 'in-place', 'clear', 'new-id', 'legacy-noop', 'workflow'] as const)(
      'makes primary text authoritative before the next processor: %s',
      async mode => {
        const list = new MessageList();
        const original: MastraDBMessage = {
          id: 'answer',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: mode === 'legacy-noop' ? [] : [{ type: 'text', text: 'Original private text.' }],
            content: 'Original private text.',
          },
        };
        list.add(original, 'response');
        const replacement = (message: MastraDBMessage): MastraDBMessage => ({
          ...message,
          id: mode === 'new-id' ? 'new-answer' : message.id,
          content: { ...message.content, parts: mode === 'clear' ? [] : [{ type: 'text', text: 'Approved text.' }] },
        });
        const processor: OutputProcessorOrWorkflow =
          mode === 'workflow'
            ? createWorkflow({
                id: 'final-parts-workflow',
                inputSchema: ProcessorStepSchema,
                outputSchema: ProcessorStepSchema,
              })
                .then(
                  createStep({
                    id: 'replace-parts',
                    inputSchema: ProcessorStepSchema,
                    outputSchema: ProcessorStepSchema,
                    execute: async ({ inputData }) => {
                      inputData.messageList.removeByIds(['answer']);
                      inputData.messageList.add(replacement(original), 'response', { merge: false });
                      return inputData;
                    },
                  }),
                )
                .commit()
            : {
                id: 'replace-parts',
                processOutputResult({ messages, messageList }) {
                  if (mode === 'legacy-noop') return messages;
                  if (mode === 'array' || mode === 'clear' || mode === 'new-id') return messages.map(replacement);
                  if (mode === 'same-list') {
                    messageList.removeByIds(['answer']);
                    messageList.add(replacement(original), 'response', { merge: false });
                    return messageList;
                  }
                  messages[0].content.parts = [{ type: 'text', text: 'Approved text.' }];
                  return messageList;
                },
              };
        let observed: string | undefined;
        const observer = {
          id: 'read-compatibility-text',
          processOutputResult({ messages }: { messages: MastraDBMessage[] }) {
            observed = messages.find(message => message.role === 'assistant')?.content.content;
            return messages;
          },
        };
        const processors =
          path === 'direct'
            ? [processor, observer]
            : [
                createWorkflow({
                  id: 'combined-final-processors',
                  inputSchema: ProcessorStepSchema,
                  outputSchema: ProcessorStepSchema,
                })
                  .then(
                    mode === 'workflow'
                      ? (processor as ReturnType<typeof createWorkflow>)
                      : createStep(processor as Parameters<typeof createStep>[0]),
                  )
                  .then(createStep(observer))
                  .commit(),
              ];
        const runner = new ProcessorRunner({ outputProcessors: processors });
        await runner.runOutputProcessors(list);
        const expected = mode === 'legacy-noop' ? 'Original private text.' : mode === 'clear' ? '' : 'Approved text.';
        expect(observed).toBe(expected);
        expect(list.get.response.db()[0].content.content).toBe(expected);
        expect(list.get.response.db()).toHaveLength(1);
        expect(list.get.response.db()[0].id).toBe(mode === 'new-id' ? 'new-answer' : 'answer');
      },
    );
  });
});
