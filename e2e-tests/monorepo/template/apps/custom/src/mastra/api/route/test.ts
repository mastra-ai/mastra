import { registerApiRoute } from '@mastra/core/server';
import { IgetYouAnything } from '@custom-lodash/index';

export const testRoute = registerApiRoute('/test', {
  method: 'GET',
  handler: async c => {
    const obj = {
      a: 'b',
    };

    return c.json({ message: 'Hello, world!', a: IgetYouAnything(obj, 'a') });
  },
});
