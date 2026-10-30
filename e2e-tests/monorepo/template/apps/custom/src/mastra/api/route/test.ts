import { registerApiRoute } from '@mastra/core/server';
import { IgetYouAnything } from '@custom-lodash/index';
import { testMessage } from '@/api/route/test.response';

export const testRoute = registerApiRoute('/test', {
  method: 'GET',
  handler: async c => {
    const obj = {
      a: 'b',
    };

    return c.json({ message: testMessage, a: IgetYouAnything(obj, 'a') });
  },
});
