import { imageAdapters } from '../../src/images/image-adapters.js';
import { imagePolicies } from './image-configuration.js';
import { createImageAgent } from '../../src/mastra/agents/image-agent.js';
import { createImageKit } from '../../src/mastra/workflows/image-kit.js';
import type { ImageService } from '../../src/images/service.js';
import type { ResourceDefinition } from '../../src/billing/resource-catalog.js';
export function imageDefinitions(environment: NodeJS.ProcessEnv, images: ImageService) {
  const [agent, workflow] = imageAdapters(images);
  return [
    { ...imagePolicies[0], ...agent, create: () => createImageAgent(environment, images) },
    { ...imagePolicies[1], ...workflow, create: createImageKit },
  ] as const satisfies readonly ResourceDefinition[];
}
