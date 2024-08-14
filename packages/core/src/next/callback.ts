import { NextRequest, NextResponse } from 'next/server';
import { IntegrationFramework } from '../index';

export const makeCallback = (framework: IntegrationFramework) => {
  return (req: NextRequest) => {
    return NextResponse.json({ hello: 'from callback' });
  };
};
