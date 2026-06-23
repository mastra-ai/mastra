type VercelRoutesOptions = {
  studio: boolean;
};

export function getVercelRoutes({ studio }: VercelRoutesOptions) {
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
