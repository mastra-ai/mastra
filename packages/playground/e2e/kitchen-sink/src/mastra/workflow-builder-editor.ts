import { Agent } from '@mastra/core/agent';
import type { IWorkflowBuilder } from '@mastra/core/editor';
import { MastraEditor } from '@mastra/editor';
import { Memory } from '@mastra/memory';
import * as aiTest from 'ai/test';

import { fixtures } from '../../fixtures';
import type { Fixtures } from '../../types';
import { storage } from './storage';

let fixtureName: Fixtures | undefined;
let fixtureTurn = 0;

const workflowBuilderAgent = new Agent({
  id: 'workflow-builder-agent',
  name: 'Workflow Builder',
  instructions: 'Build a persisted workflow by calling the provided workflow draft tools.',
  memory: new Memory({ storage }),
  model: ({ requestContext }) => {
    const requestedFixture = requestContext.get('fixture') as Fixtures | undefined;
    if (requestedFixture && requestedFixture !== fixtureName) {
      fixtureName = requestedFixture;
      fixtureTurn = 0;
    }

    const fixture = fixtureName ? fixtures[fixtureName] : undefined;
    return new aiTest.MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Mock workflow builder response' }],
        warnings: [],
      }),
      doStream: async () => {
        const chunks = fixture?.[fixtureTurn] as Array<any> | undefined;
        fixtureTurn = fixture && fixtureTurn + 1 >= fixture.length ? 0 : fixtureTurn + 1;
        return {
          stream: new ReadableStream({
            async start(controller) {
              for (const chunk of chunks ?? [
                { type: 'text-delta', delta: 'Mock workflow builder response' },
                { type: 'finish' },
              ]) {
                controller.enqueue(chunk);
                await new Promise(resolve => setTimeout(resolve, 20));
              }
              controller.close();
            },
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
  },
});

const workflowBuilder: IWorkflowBuilder = {
  enabled: true,
  getAgent: () => workflowBuilderAgent,
  getModelPolicy: () => undefined,
};

export class E2EEditor extends MastraEditor {
  override async resolveWorkflowBuilder(): Promise<IWorkflowBuilder> {
    return workflowBuilder;
  }
}
