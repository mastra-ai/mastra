import {RuntimeContext} from '@mastra/core/runtime-context';
import {FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';
import {mastra} from '../../mastra/server';
declare module 'fastify' {
  interface FastifyInstance {
    mastra: typeof mastra;
    runtimeContext: RuntimeContext<any>;
  }
}

const mastraPlugin: FastifyPluginAsync = async fastify => {
  if (!fastify.hasDecorator('mastra')) {
    const runtimeContext = new RuntimeContext<any>();
    fastify.decorate('runtimeContext', runtimeContext);
    fastify.decorate('mastra', mastra);
  } else {
    throw new Error('The `mastra` decorator has already been registered.');
  }
};

export default fp(mastraPlugin);
