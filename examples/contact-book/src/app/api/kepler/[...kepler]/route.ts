import { config } from '@kpl/config';
import { Framework } from '@kpl/core';

const kepler = Framework.init(config);
const router = kepler.createRouter();
const handler = router.registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
