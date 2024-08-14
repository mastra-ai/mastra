import { NextRequest, NextResponse } from 'next/server';
import { IntegrationFramework } from '../index';

export const makeConnect = (framework: IntegrationFramework) => {
  return (req: NextRequest) => {
    return NextResponse.json({ hello: 'from connect' });
  };
};
