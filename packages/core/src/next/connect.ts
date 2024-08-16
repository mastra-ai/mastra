import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { IntegrationFramework } from '../';
import { connectParams } from '../schemas';
import { parseQueryParams } from './utils';

type ConnectParams = z.infer<typeof connectParams>;

export const makeConnect = (framework: IntegrationFramework) => {
  return async (req: NextRequest) => {
    const {
      success,
      error,
      data: { name, connectionId, clientRedirectPath },
    } = parseQueryParams<ConnectParams>(req, connectParams);

    if (!success) {
      return NextResponse.json({ error, status: 400 });
    }

    const plugin = framework.getPlugin(name)!;
    const authenticator = plugin.getAuthenticator();
    const redirectUri = await authenticator.getRedirectUri({
      connectionId,
      clientRedirectPath,
    });

    return NextResponse.redirect(redirectUri);
  };
};
