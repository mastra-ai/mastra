import { FieldErrors } from 'react-hook-form';
import { z } from 'zod';

export const transformToNestObject = (error: z.ZodError): FieldErrors => {
  const fieldErrors: FieldErrors = {};
  error.errors.forEach(err => {
    if (err.path.length > 0) {
      const path = err.path.join('.');
      fieldErrors[path] = {
        type: 'validation',
        message: err.message,
      };
    }
  });
  return fieldErrors;
};
