import fs from 'fs';
import { mastra } from './mastra';

const agent = mastra.getAgent('e2bAgent');

const thread = 'test-thread-id-1234';
const resource = 'test-resource-id-1234';

const res = await agent.generate('What is 1824 * 2763? Execute some code to find out the exact answer.', {
  memory: {
    thread,
    resource,
  },
});

type CodeExecutionArgs = {
  runtime: string;
  code: string;
};

const blue = '\x1b[34m';
const reset = '\x1b[0m';
const green = '\x1b[32m';

for (const toolResult of res.toolResults) {
  const toolCall = res.toolCalls.find(tc => tc.payload.toolCallId === toolResult.payload.toolCallId);
  if (toolCall) {
    if (toolCall.payload.toolName === 'workspace_execute_code') {
      const call = `${
        (toolCall.payload.args as CodeExecutionArgs).runtime
      }(${JSON.stringify((toolCall.payload.args as CodeExecutionArgs).code)})`;

      let result = '';
      if ((toolResult.payload.result as any).success) {
        result = (toolResult.payload.result as any).stdout.trim();
      } else {
        result = JSON.stringify(toolResult.payload.result, null, 2);
      }

      console.log(blue + call + reset);
      console.log(blue + result + reset, '\n');
    }
  }
}

console.log(green + res.text + reset);

fs.writeFileSync('output.json', JSON.stringify(res, null, 2));
