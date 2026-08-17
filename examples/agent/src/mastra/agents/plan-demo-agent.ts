import { Agent } from '@mastra/core/agent';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { submitPlanTool } from '@mastra/core/tools';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';
import { projectRoot } from '../project-root';

const planPath = '.mastracode/plans/studio-plan-demo.md';
const planToolName = 'review_plan';
const planContent = `# Add plan rendering to Studio

## Implementation

1. Detect the core \`submit_plan\` tool by its controlled tool ID.
2. Read Markdown through the agent workspace.
3. Render the plan and approval controls in the chat transcript.
4. Persist the submitted plan in the resolved tool result.

## Verification

- Exercise the server route and client SDK.
- Verify approval and rejection in Studio.
`;

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: projectRoot }),
});

await workspace.filesystem.writeFile(planPath, planContent, { recursive: true });

function toolCallStream(toolName: string, input: Record<string, unknown>) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: `plan-demo-${Date.now()}`,
        modelId: 'mock-plan-demo',
        timestamp: new Date(),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: `${toolName}-${Date.now()}`,
        toolName,
        input: JSON.stringify(input),
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 30, totalTokens: 40 },
      });
      controller.close();
    },
  });
}

function textStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: `plan-demo-complete-${Date.now()}`,
        modelId: 'mock-plan-demo',
        timestamp: new Date(),
      });
      controller.enqueue({ type: 'text-start', id: 'plan-demo-text' });
      controller.enqueue({
        type: 'text-delta',
        id: 'plan-demo-text',
        delta: 'The plan decision was recorded.',
      });
      controller.enqueue({ type: 'text-end', id: 'plan-demo-text' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMessageRole(message: unknown): string | undefined {
  return isRecord(message) && typeof message.role === 'string' ? message.role : undefined;
}

function getMessageContent(message: unknown): unknown[] {
  return isRecord(message) && Array.isArray(message.content) ? message.content : [];
}

function getToolName(part: unknown): string | undefined {
  if (!isRecord(part) || part.type !== 'tool-call') return undefined;
  return typeof part.toolName === 'string' ? part.toolName : undefined;
}

function getToolNamesSinceLastUser(prompt: unknown): string[] {
  if (!Array.isArray(prompt)) return [];

  const lastUserIndex = prompt.map(getMessageRole).lastIndexOf('user');

  return prompt.slice(lastUserIndex + 1).flatMap(message => {
    return getMessageContent(message).flatMap(part => {
      const toolName = getToolName(part);
      return toolName ? [toolName] : [];
    });
  });
}

const mockPlanModel = new MastraLanguageModelV2Mock({
  provider: 'mock',
  modelId: 'mock-plan-demo',
  doStream: async ({ prompt }) => {
    const toolNames = getToolNamesSinceLastUser(prompt);

    if (!toolNames.includes(planToolName)) {
      return { stream: toolCallStream(planToolName, { path: planPath }) };
    }

    return { stream: textStream() };
  },
});

export const planDemoAgent = new Agent({
  id: 'plan-demo-agent',
  name: 'Plan Demo Agent',
  description: 'Deterministic submit_plan demo for verifying Studio plan rendering without an API key.',
  instructions: 'Write the plan file, then call submit_plan and wait for the user decision.',
  model: mockPlanModel,
  tools: { [planToolName]: submitPlanTool },
  workspace,
  memory: new Memory(),
});
