import { MastraClient } from '@mastra/client-js';

async function main() {
  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  // const agent = client.getAgent("webSearchAgent")

  // const aRes = await agent.stream({ messages: 'Search me restaurants in the Dogpatch San Francisco' })

  // if (!aRes.body) {
  //     throw new Error('No response body');
  // }

  const network = client.getNetwork('Research_Network');

  if (!network) {
    throw new Error('Network not found');
  }

  const response = await network.stream({
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Research Kobe Bryant' }],
      },
    ],
  });

  if (!response?.body) {
    throw new Error('No response body');
  }

  const messages = [];

  const parts = [];
  let content = '';
  let currentTextPart: { type: 'text'; text: string } | null = null;

  let assistantMessageAdded = false;

  function updater() {
    const message = {
      role: 'assistant',
      content: [{ type: 'text', text: content }],
    };

    if (!assistantMessageAdded) {
      assistantMessageAdded = true;
      return [...messages, message];
    }
    return [...messages.slice(0, -1), message];
  }

  await processDataStream({
    stream: response.body,
    onTextPart(value) {
      if (currentTextPart == null) {
        currentTextPart = {
          type: 'text',
          text: value,
        };
        parts.push(currentTextPart);
      } else {
        currentTextPart.text += value;
      }
      content += value;
      updater();
    },
    async onToolCallPart(value) {
      const invocation = {
        state: 'call',
        step,
        ...value,
      } as const;

      if (partialToolCalls[value.toolCallId] != null) {
        // change the partial tool call to a full tool call
        message.toolInvocations![partialToolCalls[value.toolCallId].index] = invocation;
      } else {
        if (message.toolInvocations == null) {
          message.toolInvocations = [];
        }

        message.toolInvocations.push(invocation);
      }

      updateToolInvocationPart(value.toolCallId, invocation);

      execUpdate();

      // invoke the onToolCall callback if it exists. This is blocking.
      // In the future we should make this non-blocking, which
      // requires additional state management for error handling etc.
      if (onToolCall) {
        const result = await onToolCall({ toolCall: value });
        if (result != null) {
          const invocation = {
            state: 'result',
            step,
            ...value,
            result,
          } as const;

          // store the result in the tool invocation
          message.toolInvocations![message.toolInvocations!.length - 1] = invocation;

          updateToolInvocationPart(value.toolCallId, invocation);

          execUpdate();
        }
      }
    },
    onErrorPart(error) {
      throw new Error(error);
    },
  });

  // if (!response.body) {
  //     throw new Error('No response body');
  // }

  // for await (const part of response.body) {
  //     console.log(part)
  // }

  // console.log(response)
}

main().catch(console.error);
