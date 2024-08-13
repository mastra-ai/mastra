import { NextRequest, NextResponse } from 'next/server';

type PathParams = {
  routes: string[];
};

/**
 * TODO: Figure out how to export this function from module to disable warning in imported app
 *  ⚠ ./src/app/api/integrations/route.ts
 * Attempted import error: 'registerRoutes' is not exported from 'core' (imported as 'registerRoutes').
 *
 * Import trace for requested module:
 * ./src/app/api/integrations/route.ts
 */
export const registerRoutes = (): ((
  req: NextRequest,
  params: any
) => NextResponse<any>) => {
  const registry: Record<string, (req: NextRequest) => NextResponse> = {
    connect: (req: NextRequest) => {
      return NextResponse.json({ hello: 'from connect new' });
    },
  };

  return (req: NextRequest, { params }: { params: PathParams }) => {
    const route = params.routes.length ? params.routes[0] : '';

    if (route in registry) {
      return registry[route](req);
    }

    return NextResponse.json({ status: 404 });
  };
};
