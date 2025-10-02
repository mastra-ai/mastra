import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import functionsData from '../data/functions.json';

type Argument = {
  name: string;
  type: string;
  description: string;
  required: boolean;
};

type Function = {
  functionName: string;
  description: string;
  arguments: Argument[];
  randomTip?: string;
  allFunctions?: string[];
};

export const docsTool = createTool({
  id: 'docsTool',
  description: 'Get detailed information about Kepler project functions, including arguments and helpful tips',
  inputSchema: z.object({
    functionName: z
      .string()
      .optional()
      .describe(
        'Name of the function (e.g., getPlanetaryData, calculateOrbitalVelocity, listNearbyStars, etc.). If not provided, returns info about a random function',
      ),
    includeRandomTip: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to include a random tip about the function'),
  }),

  execute: async ({ context }) => {
    const { functionName, includeRandomTip } = context;

    // If no function specified, pick a random one
    const functionKeys = Object.keys(functionsData);
    let selectedFunction: string;

    if (functionName) {
      selectedFunction = functionName;
      if (!functionsData[selectedFunction as keyof typeof functionsData]) {
        throw new Error(`Function "${functionName}" not found. Available functions: ${functionKeys.join(', ')}`);
      }
    } else {
      selectedFunction = functionKeys[Math.floor(Math.random() * functionKeys.length)];
    }

    const functionInfo = functionsData[selectedFunction as keyof typeof functionsData];

    const result: Function = {
      functionName: selectedFunction,
      description: functionInfo.description,
      arguments: functionInfo.arguments,
    };

    if (includeRandomTip && functionInfo.tips.length > 0) {
      const randomTipIndex = Math.floor(Math.random() * functionInfo.tips.length);
      result.randomTip = functionInfo.tips[randomTipIndex];
    }

    // If no specific function was requested, also return the list of all functions
    if (!functionName) {
      result.allFunctions = functionKeys;
    }

    return result;
  },
});
