import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';

export const parseQueryParams = (req: NextRequest, schema: ZodSchema) => {
  const { data, success, error } = schema.safeParse(
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

  return data as z.infer<typeof schema>;
};
