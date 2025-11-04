// @ts-nocheck

// Import statements - both type and value imports
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { RuntimeContext as RC } from '@mastra/core/runtime-context';

// Type definitions
type MyContext = {
  userId: string;
  tier: 'free' | 'pro';
};

// Creating instances
const runtimeContext = new RuntimeContext<MyContext>();
const ctx = new RuntimeContext();

// Setting values
runtimeContext.set('userId', '123');
runtimeContext.set('tier', 'pro');

// Type annotations
function handleRequest(runtimeContext: RuntimeContext<MyContext>) {
  return runtimeContext.get('userId');
}

// Dynamic agent config with destructured parameter
const agent = new Agent({
  name: 'test',
  model: ({ runtimeContext }: { runtimeContext: RuntimeContext<MyContext> }) => {
    return runtimeContext.get('tier') === 'pro' ? 'gpt-4' : 'gpt-3.5';
  },
  instructions: ({ runtimeContext }: { runtimeContext: RuntimeContext<MyContext> }) => {
    return `User tier: ${runtimeContext.get('tier')}`;
  },
  tools: ({ runtimeContext }) => {
    return runtimeContext.get('tier') === 'pro' ? [advancedTool] : [basicTool];
  },
});

// Calling agent methods with options
await agent.generate('Hello', { runtimeContext });
await agent.generate('Hello', { runtimeContext: runtimeContext });
await agent.stream('Hello', { runtimeContext });

// As function parameter with type
async function processWithContext(message: string, runtimeContext: RuntimeContext<MyContext>) {
  return agent.generate(message, { runtimeContext });
}

// Optional parameter
function optionalContext(runtimeContext?: RuntimeContext) {
  return runtimeContext?.get('userId');
}

// Union types
type ContextOrUndefined = RuntimeContext<MyContext> | undefined;

// In object types
interface Options {
  runtimeContext: RuntimeContext;
  other: string;
}

// Spreading
const options = { runtimeContext, other: 'value' };
await agent.generate('test', { ...options });

const mastra = new Mastra({
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          const runtimeContext = c.get('runtimeContext');
          const userId = 'unique-user-id';

          runtimeContext.set('userId', userId);

          return next();
        },
        path: '/api/*',
      },
    ],
  },
});
