import { NextRequest, NextResponse } from 'next/server';

import connect from './connect';
import callback from './callback';
import inngest from './inngest';

type PathParams = {
  [key: string]: string[];
};

export const registerRoutes = () => {
  const registry: Record<
    string,
    (req: NextRequest) => NextResponse | Promise<Response>
  > = {
    connect,
    callback,
    inngest,
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
