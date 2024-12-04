async function main() {
    // Query 1: Basic pantry ingredients
    const query1 =
        'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?';
    console.log(`Query: ${query1}`);

    const d = await fetch(`https://mastra.abhi-b57.workers.dev/agent/${encodeURIComponent('Chef Agent')}/text`, {
        method: `POST`,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [query1]
        })
    })

    console.log(d)

    const pastaResponse = await d.json()

    console.log('\n👨‍🍳 Chef Michel:', pastaResponse.text);
    console.log('\n-------------------\n');

    // // Query 2: More ingredients
    // const query2 =
    //     "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
    // console.log(`Query: ${query2}`);


    // const s = await fetch(`https://mastra-2kdvsanky-kepler-ab1bf5ab.vercel.app/agent/${encodeURIComponent('Chef Agent')}/stream`, {
    //     method: `POST`,
    //     headers: {
    //         'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //         messages: [query2]
    //     })
    // })

    // // Handle the stream

    // if (!!s.body) {
    //     let buffer = '';
    //     const delay = 30; // Adjust this value to control speed (milliseconds)

    //     for await (const chunk of s.body) {
    //         const text = new TextDecoder().decode(chunk);
    //         // Match all content between quotes after "0:"
    //         const matches = text.matchAll(/0:"([^"]*)"/g);

    //         for (const match of matches) {
    //             const content = match[1].replace(/\\n/g, '\n');
    //             await new Promise(resolve => setTimeout(resolve, delay));
    //             process.stdout.write(content);
    //             buffer = '';
    //         }
    //     }
    // }

    // console.log('\n👨‍🍳 Chef Michel: ');

    // console.log('\n\n✅ Recipe complete!');

    // // Query 3: Generate a lasagna recipe
    // const query3 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
    // console.log(`Query: ${query3}`);

    // const lasagnaResponse = await agent.textObject({
    //     messages: [query3],
    //     structuredOutput: {
    //         ingredients: {
    //             type: 'array',
    //             items: {
    //                 type: 'object',
    //                 items: {
    //                     name: {
    //                         type: 'string',
    //                     },
    //                     amount: {
    //                         type: 'number',
    //                     },
    //                 },
    //             },
    //         },
    //         steps: {
    //             type: 'array',
    //             items: {
    //                 type: 'string',
    //             },
    //         },
    //     },
    // });
    // console.log('\n👨‍🍳 Chef Michel:', lasagnaResponse.object);
    // console.log('\n-------------------\n');

    // const query4 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
    // console.log(`Query: ${query4}`);

    // const lasagnaStreamResponse = await agent.streamObject({
    //     messages: [query4],
    //     structuredOutput: {
    //         ingredients: {
    //             type: 'array',
    //             items: {
    //                 type: 'object',
    //                 items: {
    //                     name: {
    //                         type: 'string',
    //                     },
    //                     amount: {
    //                         type: 'number',
    //                     },
    //                 },
    //             },
    //         },
    //         steps: {
    //             type: 'array',
    //             items: {
    //                 type: 'string',
    //             },
    //         },
    //     },
    // });

    // console.log('\n👨‍🍳 Chef Michel: ');

    // // Handle the stream
    // for await (const chunk of lasagnaStreamResponse.textStream) {
    //     // Write each chunk without a newline to create a continuous stream
    //     process.stdout.write(chunk);
    // }

    // console.log('\n\n✅ Recipe complete!');
}

main();