import { config } from '@mastra/config';
import { Mastra } from '@mastra/core';

const mastra = Mastra.init(config);

const router = mastra.createRouter();

const handler = router.registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
