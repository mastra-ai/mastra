import {RequestContext} from '@mastra/core/di';
import {FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';
import {mastra} from '../../mastra/server';
declare module 'fastify' {
  interface FastifyInstance {
    mastra: typeof mastra;
    requestContext: RequestContext<any>;
  }
}

const mastraPlugin: FastifyPluginAsync = async fastify => {
  if (!fastify.hasDecorator('mastra')) {
    const requestContext = new RequestContext<any>();
    fastify.decorate('requestContext', requestContext);
    fastify.decorate('mastra', mastra);
  } else {
    throw new Error('The `mastra` decorator has already been registered.');
  }
};

export default fp(mastraPlugin);
