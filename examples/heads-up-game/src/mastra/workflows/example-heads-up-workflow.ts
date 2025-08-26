import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { Pool } from 'pg';

// PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const startStep = createStep({
  id: 'start-step',
  description: "Generate a famous person's name",
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
    agentResponse: z.string(),
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

    if (!userMessage) {
      // First time - ask for a question
      const message = "I'm thinking of a famous person. Ask me yes/no questions to figure out who it is!";

      await suspend({
        agentResponse: message,
      });

      return { famousPerson, gameWon: false, agentResponse: message, guessCount };
    } else {
      // Check if the user's message is a guess by using the guess verifier agent
      const guessVerifier = mastra.getAgent('guessVerifierAgent');
      const verificationResponse = await guessVerifier.generate(
        [
          {
            role: 'user',
            content: `Actual famous person: ${famousPerson}
              User's guess: "${userMessage}"
              Is this correct?`,
          },
        ],
        {
          output: z.object({
            isCorrect: z.boolean(),
          }),
        },
      );

      const gameWon = verificationResponse.object.isCorrect;

      // Let the agent handle the user's message (question or guess)
      const agent = mastra.getAgent('gameAgent');
      const response = await agent.generate(`
      The famous person is: ${famousPerson}
      The user asked: "${userMessage}"
      Is this a correct guess: ${gameWon}
      Please respond appropriately.
    `);

      const agentResponse = response.text;

      // Increment the guess count
      guessCount++;

      return { famousPerson, gameWon, agentResponse, guessCount };
    }
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

    await pool.query('INSERT INTO heads_up_games (famous_person, game_won, guess_count) VALUES ($1, $2, $3)', [
      famousPerson,
      gameWon,
      guessCount,
    ]);

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
