export function isKnowledgeEnabled(): boolean {
  return process.env.MASTRACODE_EXPERIMENTAL_KNOWLEDGE === '1';
}
