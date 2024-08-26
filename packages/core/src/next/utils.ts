import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { z, ZodSchema } from 'zod';
import qs from 'qs';

export const parseQueryParams = <T>(
  req: NextRequest,
  schema: ZodSchema
): { success: boolean; data: T; error: z.ZodError<any> | undefined } => {
  const search = req.nextUrl.search.slice(1);
  const queryParams = qs.parse(search);
  const { data, success, error } = schema.safeParse(queryParams);

  return { success, data, error };
};

export const nextHeaders = headers;
