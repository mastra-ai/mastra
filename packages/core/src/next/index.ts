import { NextRequest, NextResponse } from 'next/server';
import { Mastra } from '../framework';

import { makeConnect } from './connect';
import { makeCallback } from './callback';
import { makeInngest } from './inngest';
import { makeWebhook } from './webhook';

type PathParams = {
  [key: string]: string[];
};

export const registerRoutes = ({ framework }: { framework: Mastra }) => {
  const registry: Record<
    string,
    (req: NextRequest) => NextResponse | Promise<Response>
  > = {
    connect: makeConnect(framework),
    'connect/callback': makeCallback(framework),
    inngest: makeInngest(framework),
    webhook: makeWebhook(framework),
  };

  return (req: NextRequest, { params }: { params: PathParams }) => {
    const pathKey = Object.keys(params).at(0) ?? 'routes';
    const route = params[pathKey].length ? params[pathKey].join('/') : '';

    if (route in registry) {
      return registry[route](req);
    }

    return NextResponse.json({ status: 404 });
  };
};

export { makeConnect, makeCallback, makeInngest, makeWebhook };
