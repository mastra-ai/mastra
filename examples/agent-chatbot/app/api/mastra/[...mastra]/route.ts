import { mastra } from '@/lib/mastra/framework'

const router = mastra.createRouter()

const handler = router.registerRoutes()

export { handler as GET, handler as POST, handler as PUT }
