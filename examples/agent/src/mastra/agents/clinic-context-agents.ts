import { Agent } from '@mastra/core/agent';
import { clinicLookupTool } from '../tools/clinic-tools';

/**
 * Clinic Context Agents
 *
 * Test agents for verifying requestContext propagation through dataset
 * experiments in multi-tenant clinic scenarios.
 *
 * - clinicDirectAgent: calls clinicLookupTool directly
 * - clinicSupervisorAgent: delegates to clinicSpecialistAgent, which calls clinicLookupTool
 *
 * The tool throws if clinicId is missing from requestContext, so experiment
 * items fail visibly instead of hanging silently.
 */

export const clinicDirectAgent = new Agent({
  id: 'clinic-direct-agent',
  name: 'Clinic Direct Agent',
  description: 'Looks up patient records directly. Requires clinicId in requestContext.',
  instructions: `You are a clinic assistant that looks up patient records.
Always use the clinic-lookup tool to retrieve patient information.
Include the clinicId and patientId in your response so the caller can verify tenant isolation.`,
  model: 'openai/gpt-5.4-mini',
  tools: {
    clinicLookupTool,
  },
});

export const clinicSpecialistAgent = new Agent({
  id: 'clinic-specialist-agent',
  name: 'Clinic Specialist Agent',
  description: 'Specialist sub-agent that looks up patient records. Requires clinicId in requestContext.',
  instructions: `You are a clinical specialist. When asked to look up patient data, use the clinic-lookup tool.
Always include the clinicId and patientId in your response.`,
  model: 'openai/gpt-5.4-mini',
  tools: {
    clinicLookupTool,
  },
});

export const clinicSupervisorAgent = new Agent({
  id: 'clinic-supervisor-agent',
  name: 'Clinic Supervisor Agent',
  description: 'Supervisor agent that delegates patient lookups to the specialist sub-agent. Tests requestContext propagation through agent delegation.',
  instructions: `You are a clinic supervisor. When a user asks you to look up patient data, delegate the task to the clinic-specialist-agent.
Do not look up records yourself — always hand off to the specialist.
Report back the specialist's response, including the clinicId they used.`,
  model: 'openai/gpt-5.4-mini',
  agents: {
    clinicSpecialistAgent,
  },
});
