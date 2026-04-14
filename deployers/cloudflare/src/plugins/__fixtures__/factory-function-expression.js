import { Mastra } from '@mastra/core/mastra';
import { D1Store } from '@mastra/cloudflare-d1';

export const mastra = function (env) {
  return new Mastra({
    storage: new D1Store({ binding: env.D1Database }),
  });
};
