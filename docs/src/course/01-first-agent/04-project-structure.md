# Verifying Project Structure

Let's check that your project has the correct structure. You should have:

1. A `src/mastra` directory that contains:
   - `index.ts` - The main entry point for your Mastra project
   - `agents/` - Directory containing individual agent files
   - `tools/` - Directory containing individual tool files
   - `workflows/` - Directory containing individual workflow files

If the CLI created your project, you should see files like:
   - `agents/weather-agent.ts` - Example weather agent
   - `tools/weather-tool.ts` - Example weather tool
   - `workflows/weather-workflow.ts` - Example weather workflow

This structure is important because it follows the current Mastra convention for organizing your code. Each component (agent, tool, workflow) gets its own file for better organization and maintainability.
