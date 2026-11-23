import { Agent } from '@mastra/core/agent';
import { studioPreviewAgent } from './studio-preview-agent';

export const workflowReviewAgent = new Agent({
  id: 'workflow-review-agent',
  name: 'Workflow Review Agent',
  instructions: 'Summarize the supplied request in one sentence. Do not call external tools.',
  model: context => studioPreviewAgent.getModel({ requestContext: context.requestContext }),
  inputProcessors: [
    {
      id: 'preview-request-guard',
      processInput: ({ messages, abort }) => {
        const requestsTripwire = messages.some(
          message =>
            message.role === 'user' &&
            message.content.parts.some(part => part.type === 'text' && part.text.includes('preview-tripwire')),
        );
        if (requestsTripwire) abort('The preview request guard blocked this input before calling the model.');
        return messages;
      },
    },
  ],
});
