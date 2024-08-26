import { config } from '@arkw/config';
import { createFramework } from '@arkw/core';

const handler = createFramework(config).registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
