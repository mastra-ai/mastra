import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';

const explorer = cosmiconfig('mastra.config', {
  searchPlaces: ['mastra.config.json'],
});

const configSchema = z.object({
  dirPath: z.string(),
  llmProvider: z.enum(['openai', 'anthropic', 'groq']),
});

export type Config = z.infer<typeof configSchema>;

export async function getConfig(cwd: string): Promise<Config | null> {
  const configResult = await explorer.search(cwd);

  if (!configResult) {
    return null;
  }

  return configSchema.parse(configResult.config);
}
