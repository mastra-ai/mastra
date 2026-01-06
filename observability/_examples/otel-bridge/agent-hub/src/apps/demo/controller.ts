import {trace} from '@opentelemetry/api';
import {
  FastifyPluginAsyncZod,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import z from 'zod';
import {scienceChatAgent} from './agents/test-agent';
import {asException} from '../../core/telemetry/utils';

const tracer = trace.getTracer('demo-controller');

const demoController: FastifyPluginAsyncZod = async fastify => {
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.post(
    '/v1',
    {
      schema: {
        body: z.object({
          message: z.string(),
        }),
      },
    },
    async (req, res) => {
      const {message} = req.body;
      return tracer.startActiveSpan('demo-controller', {attributes: {message}}, async span => {
        try {
          const response = await scienceChatAgent.generate([
            {
              role: 'user',
              content: message,
            },
          ]);
          return res.status(200).send({
            response: response.text,
            traceId: response.traceId,
          });
        } catch (error) {
          span.recordException(asException(error));
          return res.status(500).send({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        } finally {
          span.end();
        }
      });
    },
  );
};

export default demoController;
