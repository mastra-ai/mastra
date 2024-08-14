import { NextRequest, NextResponse } from 'next/server';
import { IntegrationFramework } from '../index';
import { connectParams } from '../schemas';

export const makeConnect = (framework: IntegrationFramework) => {
  return async (req: NextRequest) => {
    const { data, success, error } = connectParams.safeParse(
      Array.from(new URLSearchParams(req.nextUrl.search).entries()).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value,
        }),
        {} as Record<string, string>
      )
    );

    if (!success) {
      return NextResponse.json({ error, status: 400 });
    }

    const { name, connectionId } = data;
    const plugin = framework.getPlugin(name)!;
    const authenticator = plugin.getAuthenticator();
    const redirectUri = await authenticator.getRedirectUri({
      connectionId,
    });

    return NextResponse.redirect(redirectUri);
  };
};
