import { registerRoutes } from '@arkw/core';

import { getFramework } from '@/lib/framework-utils';

let handler;

async function init() {
  const framework = await getFramework();
  if (!framework) {
    throw new Error('Framework is undefined');
  }

  const handler = registerRoutes({ framework });
}

init();

export { handler as GET, handler as POST, handler as PUT };
