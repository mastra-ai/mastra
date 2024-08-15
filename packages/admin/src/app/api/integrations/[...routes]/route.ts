import { registerRoutes } from 'core';

import { future as framework } from '../../../../../example.future.config';

const handler = registerRoutes({ framework });

export { handler as GET, handler as POST, handler as PUT };
