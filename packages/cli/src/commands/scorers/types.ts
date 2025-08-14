export type Category = 'output-quality' | 'accuracy-and-reliability';

export interface ScorerTemplate {
  id: string;
  name: string;
  description: string;
  category: Category;
  filename: string;
}
