import { NextRequest, NextResponse } from 'next/server';

export default (req: NextRequest) => {
  return NextResponse.json({ hello: 'from connect' });
};
