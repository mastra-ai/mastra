import { MastraClient } from './client';

(async () => {
  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  try {
    const agent = client.getAgent('weatherAgent');
    const response = await agent.stream({
      messages: [
        {
          role: 'user',
          content: 'Hello, world!',
        },
      ],
    });

    const reader = response?.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      if (!reader) break;
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      buffer += chunk;

      console.log(buffer);

      const matches = buffer.matchAll(/0:"([^"]*)"/g);

      for (const match of matches) {
        const content = match[1];
        process.stdout.write(`${content}\n`);
      }
    }
  } catch (error) {
    console.error(error);
  }
})();
