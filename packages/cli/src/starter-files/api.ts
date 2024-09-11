import { config } from '@kepler/config';
import { createFramework } from '@kepler/core';

const handler = createFramework(config).registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
