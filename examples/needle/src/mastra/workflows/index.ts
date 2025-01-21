import { knowledgeAgent } from '../agents';

export async function searchAndAnswer(query: string) {
  const result = await knowledgeAgent.generate(query);
  return result.text;
}
