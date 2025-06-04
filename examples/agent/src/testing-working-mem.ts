import { mastra } from './mastra';

async function main() {
  const agent = mastra.getAgent('workingMemoryExampleAgent');

  const { text: textOne } = await agent.generate(
    `
        Hi I am Abhi. I am the CTO of Mastra.
        My friend Ward also works with me as a Founding Engineer.
        I have other friends too:
            RudeBoy - CIO of a Medical Company
            Sujay - The Stumbler Bumbler and Fumbler
            Marvin - The French Man
            Josef - The man in search of client side tools
    `,
    {
      resourceId: '1',
      threadId: '1',
    },
  );

  console.log(textOne);

  const memory = agent.getMemory();

  const workingMemory = await memory?.getWorkingMemory({ threadId: '1', format: 'json' });

  console.log(workingMemory);
}

main().catch(console.error);
