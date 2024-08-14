import { NextRequest, NextResponse } from 'next/server';
import { IntegrationFramework } from '../';

import { makeConnect } from './connect';
import { makeCallback } from './callback';
import { makeInngest } from './inngest';

type PathParams = {
  [key: string]: string[];
};

export const registerRoutes = ({
  framework,
}: {
  framework: IntegrationFramework;
}) => {
  const registry: Record<
    string,
    (req: NextRequest) => NextResponse | Promise<Response>
  > = {
    connect: makeConnect(framework),
    callback: makeCallback(framework),
    inngest: makeInngest(framework),
  };

  return (req: NextRequest, { params }: { params: PathParams }) => {
    const pathKey = Object.keys(params).at(0) ?? 'routes';
    const route = params[pathKey].length ? params[pathKey][0] : '';

    if (route in registry) {
      return registry[route](req);
    }

    return NextResponse.json({ status: 404 });
  };
};
