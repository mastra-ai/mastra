import {FastifyPluginAsync} from 'fastify';

const healthchecks: FastifyPluginAsync = async fastify => {
  fastify.get('/ping', async () => ({
    status: 'ok',
    envname: process.env.ENVIRONMENT_NAME,
    region: process.env.REGION_NAME,
  }));
};

export default healthchecks;
