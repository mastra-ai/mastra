import { z, ZodSchema } from 'zod';
import { Inngest } from 'inngest';

type Config = {
  events: {
    [key: string]: {
      schema: ZodSchema;
    };
  };
};

const inngest = new Inngest({ id: 'test' });

class FrameworkTyped<C extends Config = Config> {
  constructor(public config: C) {}

  async sendEvent<K extends keyof C['events']>({
    name,
    data,
  }: {
    name: K;
    data: z.infer<C['events'][K]['schema']>;
  }) {
    await inngest.send({
      name: name as string,
      data,
    });
  }
}

const framework = new FrameworkTyped({
  events: {
    'user.created': {
      schema: z.object({
        id: z.string(),
        name: z.string(),
      }),
    },
  },
});

framework.sendEvent({
  name: 'user.created',
  data: {
    id: '1',
    name: 'Alice',
  },
});
