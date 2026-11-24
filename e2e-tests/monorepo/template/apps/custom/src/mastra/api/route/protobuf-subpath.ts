import { registerApiRoute } from '@mastra/core/server';

export const protobufSubpathRoute = registerApiRoute('/protobuf-subpath', {
  method: 'GET',
  handler: async c => {
    const { TimestampSchema } = await import('@bufbuild/protobuf/wkt');

    return c.json({ typeName: TimestampSchema.typeName });
  },
});
