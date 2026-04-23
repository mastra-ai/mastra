import { z } from 'zod';

export const doSomething = () => {
  const schema = z.string();
  return schema.parse('hello');
};
