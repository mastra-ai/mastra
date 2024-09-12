import { config } from '@kpl/config';
import { createFramework } from '@kpl/core';

const handler = createFramework(config).registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
