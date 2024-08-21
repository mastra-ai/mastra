import arkw from '@/arkw.config';

const handler = arkw.registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
