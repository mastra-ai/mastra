import {FastifyPluginAsync} from 'fastify';

const healthchecks: FastifyPluginAsync = async fastify => {
  fastify.get('/ping', async () => ({
    status: 'ok',
  }));
};

export default healthchecks;
