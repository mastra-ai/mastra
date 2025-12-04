import { mastra } from './mastra/index';

const tools = mastra.listTools();

// console.log('agent', agent);
console.log('[TOOLS]', await tools?.['calculator']?.execute?.({ num1: 1, num2: 2, operation: 'add' }));