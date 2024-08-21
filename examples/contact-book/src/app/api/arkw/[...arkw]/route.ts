import { registerRoutes } from '@arkw/core';

import arkw from '@/arkw.config';

const handler = registerRoutes({ framework: arkw });

export { handler as GET, handler as POST, handler as PUT };
