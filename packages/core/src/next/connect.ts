import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Mastra } from '../framework';
import { connectParams } from '../schemas';
import { parseQueryParams } from './utils';

type ConnectParams = z.infer<typeof connectParams>;

export const makeConnect = (framework: Mastra) => {
  return async (req: NextRequest) => {
    const {
      success,
      error,
      data: { name, connectionId, clientRedirectPath },
    } = parseQueryParams<ConnectParams>(req, connectParams);

    if (!success) {
      return NextResponse.json({ error, status: 400 });
    }

    const int = framework.getIntegration(name)!;
    const authenticator = int.getAuthenticator();
    const redirectUri = await authenticator.getRedirectUri({
      connectionId,
      clientRedirectPath,
    });

    return NextResponse.redirect(redirectUri);
  };
};
