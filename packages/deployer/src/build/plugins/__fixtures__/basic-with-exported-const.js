import { Mastra } from '@mastra/core/mastra';
import { TestDeployer } from '@mastra/deployer/test';
import { weatherAgent } from '@/agents';

// The extracted option references a separately exported const with the same
// name as the option, used as a shorthand property.
export const deployer = new TestDeployer();

export const mastra = new Mastra({
  agents: { weatherAgent },
  deployer,
});
