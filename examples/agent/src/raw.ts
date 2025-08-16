async function main() {
  async function uiMessage() {
    const response = await fetch('http://localhost:4111/api/agents/chefAgent/stream/ui', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
      }),
    });

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the Uint8Array to text
      const text = decoder.decode(value, { stream: true });
      console.log(text);
    }
  }

  // uiMessage()

  async function streamAISDKV5() {
    const response = await fetch('http://localhost:4111/api/agents/chefAgent/stream/vnext', {
      method: 'POST',
      body: JSON.stringify({
        format: 'aisdk',
        messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
      }),
    });

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the Uint8Array to text
      const text = decoder.decode(value, { stream: true });
      console.log(text);
    }
  }

  // streamAISDKV5()

  async function streamMastra() {
    const { processMastraStream, TextAccumulator } = await import('./stream-processor');

    const response = await fetch('http://localhost:4111/api/agents/chefAgent/stream/vnext', {
      method: 'POST',
      body: JSON.stringify({
        format: 'mastra',
        messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
      }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const textAccumulator = new TextAccumulator();

    await processMastraStream({
      stream: response.body,

      onTextDelta: chunk => {
        textAccumulator.handleTextDelta(chunk);
        process.stdout.write(chunk.payload.text);
      },

      onToolCall: chunk => {
        console.log('\n🔧 Tool Call:', {
          id: chunk.payload.toolCallId,
          name: chunk.payload.toolName,
          args: chunk.payload.args,
        });
      },

      onToolResult: chunk => {
        console.log('\n✅ Tool Result:', {
          id: chunk.payload.toolCallId,
          result: chunk.payload.result,
        });
      },

      onReasoningStart: chunk => {
        console.log('\n🧠 Reasoning started:', chunk.payload.id);
      },

      onReasoningDelta: chunk => {
        console.log('💭 Reasoning:', chunk.payload.text);
      },

      onFile: chunk => {
        console.log('\n📁 File:', {
          mimeType: chunk.payload.mimeType,
          size: chunk.payload.data?.length || 'unknown',
        });
      },

      onSource: chunk => {
        console.log('\n📄 Source:', {
          type: chunk.payload.sourceType,
          title: chunk.payload.title,
          url: chunk.payload.url,
        });
      },

      onStepStart: chunk => {
        console.log('\n🚀 Step started');
      },

      onStepFinish: chunk => {
        console.log('\n✅ Step finished');
      },

      onStart: chunk => {
        console.log('\n▶️ Stream started');
      },

      onFinish: chunk => {
        console.log('\n🏁 Stream finished');
        console.log('\nFinal accumulated text:', textAccumulator.getText());
      },

      onError: chunk => {
        console.error('\n❌ Error:', chunk.payload);
      },

      onParseError: (error, rawText) => {
        console.error('Parse error:', error.message);
        console.error('Raw text:', rawText);
      },
    });
  }

  streamMastra();
}

main();
