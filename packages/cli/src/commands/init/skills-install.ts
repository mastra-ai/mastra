import { execa } from 'execa';

export async function installMastraSkills({
  directory,
  agents,
}: {
  directory: string;
  agents: string[];
}): Promise<{ success: boolean; error?: string; agents: string[] }> {
  try {
    // Build args: --agent takes space-separated agent names
    const args = ['skills', 'add', 'mastra-ai/skills', '--agent', ...agents, '-y'];

    await execa('npx', args, {
      cwd: directory,
      stdio: 'pipe', // Hide verbose output
    });

    return { success: true, agents };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      agents,
    };
  }
}
