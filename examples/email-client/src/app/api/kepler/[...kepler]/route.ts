import { Framework } from '@kpl/core';

import { config } from '../../../../../kepler.config';

const handler = Framework.init(config).registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
