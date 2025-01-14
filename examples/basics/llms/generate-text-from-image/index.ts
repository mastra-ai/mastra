import { Mastra } from '@mastra/core';

async function main() {
  const mastra = new Mastra({});

  const llm = mastra.LLM({
    provider: 'OPEN_AI',
    name: 'gpt-4-turbo',
  });

  const response = await llm.generate([
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'what is that black bold text at the top?',
        },
        {
          type: 'image',
          image: new URL(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/491_BC_-_1902_AD_-_A_Long_Time_Between_Drinks.jpg/1000px-491_BC_-_1902_AD_-_A_Long_Time_Between_Drinks.jpg',
          ),
        },
      ],
    },
  ]);

  console.log(response.text);
}

main();
