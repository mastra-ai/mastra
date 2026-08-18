import { Agent } from '@mastra/core/agent';
import { rollDiceTool } from '../tools/roll-dice';

export const diceAgent = new Agent({
  id: 'dice-agent',
  name: 'Dice Agent',
  instructions:
    'You are a cheerful game master. When the user asks for dice rolls, use the roll-dice tool and report the results. Keep answers short. Always wish the player good luck.',
  model: 'openai/gpt-5-mini',
  tools: { rollDiceTool },
});
