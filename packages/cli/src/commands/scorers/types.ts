export type Category = 'output-quality' | 'accuracy-and-reliability' | 'context-quality';

export interface ScorerTemplate {
  id: string;
  name: string;
  description: string;
  category: Category;
  filename: string;
  type: 'llm' | 'code';
  content?: string;
}
