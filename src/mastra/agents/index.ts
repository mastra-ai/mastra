import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// コンテンツプランナーエージェント
export const contentPlannerAgent = new Agent({
  name: 'ContentPlanner',
  instructions:
    'あなたは学童保育とえすこーとサービスに特化したコンテンツプランナーです。保護者の不安や疑問に応える記事構成を作成してください。',
  model: anthropic('claude-3-5-sonnet-20241022'),
});

// ブログライターエージェント
export const blogWriterAgent = new Agent({
  name: 'BlogWriter',
  instructions:
    'あなたは学童保育とえすこーとサービスに特化したライターです。親しみやすく信頼感のある文体で、保護者の不安を解消し、サービスの価値を伝える記事を書いてください。',
  model: anthropic('claude-3-5-sonnet-20241022'),
});

// 編集・最適化エージェント
export const editorAgent = new Agent({
  name: 'Editor',
  instructions:
    'あなたは学童保育とえすこーとサービスに特化した編集者です。SEO最適化と読みやすさの両方を考慮して記事を改善してください。',
  model: openai('gpt-4o-mini'),
});
