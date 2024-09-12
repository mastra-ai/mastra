import { registerRoutes } from '@kepler/core';

import { framework } from '@/lib/framework-utils';

if (!framework) {
  throw new Error('Framework not found');
}

const handler = registerRoutes({ framework });

export { handler as GET, handler as POST, handler as PUT };
