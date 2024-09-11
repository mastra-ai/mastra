import { createFramework } from '@kpl/core';

import { config } from '../../../../../kpl.config';

const handler = createFramework(config).registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
