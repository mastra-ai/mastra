import { mastra } from './mastra';

// Get agents and ensure getters like 'instructions' are included in the JSON output
const agents = mastra.listAgents();

// Create a custom serializer to handle getter properties
const serializedAgents: Record<string, any> = {};
Object.entries(agents).forEach(([key, agent]: [string, any]) => {
  serializedAgents[key] = {
    // Only include specific properties we know exist
    name: agent.name,
    instructions: agent.getInstructions(),
    // Add any other properties that need to be explicitly accessed
  };

  // Copy any other enumerable properties
  for (const prop in agent) {
    if (prop !== 'name' && prop !== 'instructions') {
      serializedAgents[key][prop] = agent[prop];
    }
  }
});

console.log(JSON.stringify(serializedAgents, null, 2));
