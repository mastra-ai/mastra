import { framework } from '@/lib/framework-utils';

if (!framework) {
  throw new Error('Framework not found');
}

const router = framework.createRouter();
const handler = router.registerRoutes();

export { handler as GET, handler as POST, handler as PUT };
