import type { Resolver } from 'react-hook-form';
import { z } from 'zod';

import { transformToNestObject } from '../utils';

export const customZodUnionResolver = (schemaUnion: z.ZodTypeAny, discriminator: string): Resolver<any> => {
  return async values => {
    //get schema based on discriminator
    const schema =
      schemaUnion?._def?.options?.find(
        (option: any) => option?.shape?.[discriminator]?._def?.value === values[discriminator],
      ) || z.object({ [discriminator]: z.string() });

    // Filter out keys that are not in the schema
    const filteredValues = Object.fromEntries(Object.entries(values).filter(([key]) => (schema as any)?.shape?.[key]));

    const result = schema.safeParse(filteredValues);

    if (result.success) {
      return { values: result.data, errors: {} };
    } else {
      const errors = transformToNestObject(result.error);
      return { values: {}, errors };
    }
  };
};
