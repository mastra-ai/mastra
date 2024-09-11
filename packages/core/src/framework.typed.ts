import { z, ZodSchema } from 'zod';
import { Inngest } from 'inngest';
import { Config, IntegrationContext, ZodeSchemaGenerator } from './types';

const inngest = new Inngest({ id: 'test' });

class FrameworkTyped<C extends Config = Config> {
  constructor(public config: C) {}

  async sendEvent<
    K extends keyof C['systemEvents'],
    SC extends C['systemEvents'][K]['schema']
  >({
    name,
    data,
  }: {
    name: K;
    data: SC extends ZodSchema
      ? z.infer<SC>
      : SC extends ZodeSchemaGenerator
      ? z.infer<Awaited<ReturnType<SC>>>
      : never;
  }) {
    await inngest.send({
      name: name as string,
      data,
    });
  }
}

const framework = new FrameworkTyped({
  blueprintDirPath: '',
  db: { provider: '', uri: '' },
  integrations: [],
  name: '',
  routeRegistrationPath: '',
  systemApis: [],
  systemHostURL: '',
  systemEvents: {
    'user.created': {
      schema: z.object({
        id: z.string(),
        name: z.string(),
      }),
    },
    'user.deleted': {
      schema: async ({ ctx }: { ctx: IntegrationContext }) =>
        z.object({
          id: z.string(),
          name: z.string(),
          deletedAt: z.date(),
        }),
    },
  },
});

framework.sendEvent({
  name: 'user.created',
  data: {
    id: 'hello',
    name: 'world',
  },
});

framework.sendEvent({
  name: 'user.deleted',
  data: {
    id: 'hello',
    name: 'world',
    deletedAt: new Date(),
    // notakey: 'notavalue',
  },
});
