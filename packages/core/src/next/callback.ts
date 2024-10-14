import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Mastra } from '../framework';
import { callbackParams } from '../schemas';
import { parseQueryParams } from './utils';

type CallBackParams = z.infer<typeof callbackParams>;

export const makeCallback = (framework: Mastra) => {
  return async (req: NextRequest) => {
    const { data, error } = parseQueryParams<CallBackParams>(
      req,
      callbackParams
    );
    const {
      state: { name, clientRedirectPath },
      error: callbackError,
    } = data;

    if (error || callbackError) {
      return NextResponse.json({ error, status: 400 });
    }

    const int = framework.getIntegration(name);

    if (!int) {
      return NextResponse.json({
        error: `Callback state cannot locate integration: "${name}"`,
        status: 400,
      });
    }

    await int.getAuthenticator().processCallback(req.url);

    const redirectUri = new URL(
      clientRedirectPath || '',
      req.nextUrl.protocol + '//' + req.nextUrl.host
    );

    return NextResponse.redirect(redirectUri);
  };
};
