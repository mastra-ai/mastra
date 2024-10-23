export const dynamic = 'force-dynamic' // static by default, unless reading the request

export async function GET(request: Request) {
  // If it is a prime time day, we call our workflow.
  const { mastra } = await import('../../../lib/mastra/framework')

  await mastra.triggerEvent({
    key: 'CRAWL_SITE_SYNC',
    data: {
      url: 'https://www.sdbio.org/blog',
      entityType: 'biotechblog'
    },
    user: {
      connectionId: 'SYSTEM'
    }
  })

  return new Response(`Sync started.`)
}
