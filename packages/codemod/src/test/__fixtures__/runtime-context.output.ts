// @ts-nocheck

// Import statements - both type and value imports
import { RequestContext } from '@mastra/core/request-context';
import type { RequestContext as RC } from '@mastra/core/request-context';

// Type definitions
type MyContext = {
  userId: string;
  tier: 'free' | 'pro';
};

// Creating instances
const requestContext = new RequestContext<MyContext>();
const ctx = new RequestContext();

// Setting values
requestContext.set('userId', '123');
requestContext.set('tier', 'pro');

// Type annotations
function handleRequest(requestContext: RequestContext<MyContext>) {
  return requestContext.get('userId');
}

// Dynamic agent config with destructured parameter
const agent = new Agent({
  name: 'test',
  model: ({ requestContext }: { requestContext: RequestContext<MyContext> }) => {
    return requestContext.get('tier') === 'pro' ? 'gpt-4' : 'gpt-3.5';
  },
  instructions: ({ requestContext }: { requestContext: RequestContext<MyContext> }) => {
    return `User tier: ${requestContext.get('tier')}`;
  },
  tools: ({ requestContext }) => {
    return requestContext.get('tier') === 'pro' ? [advancedTool] : [basicTool];
  },
});

// Calling agent methods with options
await agent.generate('Hello', { requestContext });
await agent.generate('Hello', { requestContext: requestContext });
await agent.stream('Hello', { requestContext });

// As function parameter with type
async function processWithContext(message: string, requestContext: RequestContext<MyContext>) {
  return agent.generate(message, { requestContext });
}

// Optional parameter
function optionalContext(requestContext?: RequestContext) {
  return requestContext?.get('userId');
}

// Union types
type ContextOrUndefined = RequestContext<MyContext> | undefined;

// In object types
interface Options {
  requestContext: RequestContext;
  other: string;
}

// Spreading
const options = { requestContext, other: 'value' };
await agent.generate('test', { ...options });

const mastra = new Mastra({
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          const requestContext = c.get('requestContext');
          const userId = 'unique-user-id';

          requestContext.set('userId', userId);

          return next();
        },
        path: '/api/*',
      },
    ],
  },
});
