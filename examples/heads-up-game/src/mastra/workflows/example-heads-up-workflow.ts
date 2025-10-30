import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const startStep = createStep({
  id: 'start-step',
  description: 'Get the name of a famous person',
  inputSchema: z.object({
    start: z.boolean(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    guessCount: z.number(),
  }),
  execute: async ({ mastra }) => {
    const agent = mastra.getAgent('famousPersonAgent');
    const response = await agent.generate("Generate a famous person's name", {
      temperature: 1.2,
      topP: 0.9,
      memory: {
        resource: 'heads-up-game',
        thread: 'famous-person-generator',
      },
    });
    const famousPerson = response.text.trim();
    return { famousPerson, guessCount: 0 };
  },
});

const gameStep = createStep({
  id: 'game-step',
  description: 'Handles the question-answer-continue loop',
  inputSchema: z.object({
    famousPerson: z.string(),
    guessCount: z.number(),
  }),
  resumeSchema: z.object({
    userMessage: z.string(),
  }),
  suspendSchema: z.object({
    suspendResponse: z.string(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    agentResponse: z.string(),
    guessCount: z.number(),
  }),
  execute: async ({ inputData, mastra, resumeData, suspend }) => {
    let { famousPerson, guessCount } = inputData;
    const { userMessage } = resumeData ?? {};

    // Return suspend with message to inform the user
    if (!userMessage) {
      return await suspend({
        suspendResponse: "I'm thinking of a famous person. Ask me yes/no questions to figure out who it is!",
      });
    }

    // Let the agent handle the user's message (question or guess)
    const agent = mastra.getAgent('gameAgent');
    const response = await agent.generate(
      `
        The famous person is: ${famousPerson}
        The user said: "${userMessage}"
        Please respond appropriately. If this is a guess, tell me if it's correct.
      `,
      {
        output: z.object({
          response: z.string(),
          gameWon: z.boolean(),
        }),
      },
    );

    // Values from structured output object
    const { response: agentResponse, gameWon } = response.object;

    // Increment the guess count
    guessCount++;

    return { famousPerson, gameWon, agentResponse, guessCount };
  },
});

const winStep = createStep({
  id: 'win-step',
  description: 'Handle game win logic',
  inputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    agentResponse: z.string(),
    guessCount: z.number(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    guessCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { famousPerson, gameWon, guessCount } = inputData;

    console.log('famousPerson: ', famousPerson);
    console.log('gameWon: ', gameWon);
    console.log('guessCount: ', guessCount);

    return { famousPerson, gameWon, guessCount };
  },
});

export const headsUpWorkflow = createWorkflow({
  id: 'heads-up-workflow',
  inputSchema: z.object({
    start: z.boolean(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    guessCount: z.number(),
  }),
})
  .then(startStep)
  .dountil(gameStep, async ({ inputData: { gameWon } }) => gameWon)
  .then(winStep)
  .commit();
