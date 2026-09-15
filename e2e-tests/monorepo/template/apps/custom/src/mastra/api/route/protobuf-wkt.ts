import { registerApiRoute } from '@mastra/core/server';

export const protobufWktRoute = registerApiRoute('/protobuf-wkt', {
  method: 'GET',
  handler: async c => {
    const { TimestampSchema } = await import('@bufbuild/protobuf/wkt');

    return c.json({ typeName: TimestampSchema.typeName });
  },
});
