import {MastraAgent} from '@ag-ui/mastra';
import {CopilotRuntime, copilotRuntimeNodeHttpEndpoint} from '@copilotkit/runtime';
import {FastifyPluginAsync} from 'fastify';
import {openaiServiceAdapter} from '../../copilotkit';

const copilotkitEndpoint = '/copilotkit';

const copilotkit: FastifyPluginAsync = async fastify => {
  fastify.route({
    url: copilotkitEndpoint,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, res) => {
      const aguiAgents = MastraAgent.getLocalAgents({
        resourceId: fastify.runtimeContext.get('resourceId'),
        mastra: fastify.mastra,
        runtimeContext: fastify.runtimeContext,
      });

      const runtime = new CopilotRuntime({
        agents: aguiAgents,
      });

      const endpoint = copilotRuntimeNodeHttpEndpoint({
        runtime,
        serviceAdapter: openaiServiceAdapter,
        endpoint: copilotkitEndpoint,
      });

      return endpoint.handleNodeRequestAndResponse(req, res);
    },
  });
};

export default copilotkit;
