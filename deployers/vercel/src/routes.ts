export function getVercelRoutes(studio: boolean) {
  return studio
    ? [
        { src: '^/$', dest: '/index.html' },
        { src: '/api/(.*)', dest: '/' },
        { src: '/health', dest: '/' },
        { handle: 'filesystem' as const },
        { src: '/(.*)', dest: '/index.html', check: true },
      ]
    : [{ src: '/(.*)', dest: '/' }];
}
