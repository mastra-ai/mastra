import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';

export const parseQueryParams = <T>(
  req: NextRequest,
  schema: ZodSchema
): { success: boolean; data: T; error: z.ZodError<any> | undefined } => {
  const { data, success, error } = schema.safeParse(
    Array.from(new URLSearchParams(req.nextUrl.search).entries()).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value,
      }),
      {} as Record<string, string>
    )
  );

  return { success, data, error };
};
