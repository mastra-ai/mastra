"use server";

import { getAgent } from "@monorepo/ai";

export async function askQuestion(query: string) {
  const agent = await getAgent("myAgent")
  const response = await agent.generate(query)
  return {
    answer: response.text,
  };
}
