import { registerRoutes } from 'core';

const handler = registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
