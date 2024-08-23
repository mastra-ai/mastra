import { createFramework } from '@arkw/core';

import { config } from '../../../../../arkw.config';

const handler = createFramework(config).registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
