import { config } from '@kpl/config';
import { Framework } from '@kpl/core';

const handler = Framework.init(config).registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
