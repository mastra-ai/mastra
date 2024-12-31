async function main() {
  // Query 2: More ingredients
  const query2 =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  console.log(`Query: ${query2}`);

  const s = await fetch(`https://mastra.abhiaiyer91.workers.dev/agent/${encodeURIComponent('Chef Agent')}/stream`, {
    method: `POST`,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [query2],
    }),
  });

  console.log(s);

  // Handle the stream

  if (!!s.body) {
    let buffer = '';
    const delay = 30; // Adjust this value to control speed (milliseconds)

    for await (const chunk of s.body) {
      const text = new TextDecoder().decode(chunk);
      // Match all content between quotes after "0:"
      const matches = text.matchAll(/0:"([^"]*)"/g);

      for (const match of matches) {
        const content = match[1].replace(/\\n/g, '\n');
        await new Promise(resolve => setTimeout(resolve, delay));
        process.stdout.write(content);
        buffer = '';
      }
    }
  }
}

main();
