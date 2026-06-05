/**
 * Resolve the agent instructions (system prompt). Uses explicit instructions
 * when provided, otherwise generates a default from the name and description.
 * Infra-agnostic — no workflow ctx.
 */
export function resolveInstructions(name: string, description: string, explicitInstructions?: string): string {
  if (typeof explicitInstructions === 'string') {
    return explicitInstructions;
  }

  return `You are ${name}.\n\n${description}\n\nHelp the user accomplish this outcome. Make reasonable assumptions and avoid asking unnecessary follow-up questions.`;
}
