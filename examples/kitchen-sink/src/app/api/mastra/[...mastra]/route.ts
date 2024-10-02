import { config } from '@mastra/config';
import { Framework } from '@mastra/core';

const mastra = Framework.init(config);

const router = mastra.createRouter();

const handler = router.registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
