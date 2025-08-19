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
}

main();
