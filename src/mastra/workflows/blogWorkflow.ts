import { Workflow, Step } from "@mastra/core/workflows";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { rakkoKeywordTool } from "../tools/rakkoKeyword";
import { 
  keywordResearcherAgent, 
  contentPlannerAgent, 
  blogWriterAgent, 
  editorAgent 
} from "../agents";

// 学童えすこーと専用ブログ生成ワークフロー
export const escortBlogWorkflow = new Workflow({
  name: "escort-blog-workflow",
  triggerSchema: z.object({
    topic: z.string().describe("学童えすこーとサービスに関連するブログトピック"),
    targetAge: z.string().optional().describe("対象となる子どもの年齢層"),
    serviceFeature: z.string().optional().describe("アピールしたいサービスの特徴"),
  }),
});

// Step 1: キーワードリサーチのステップ
const keywordStep = new Step({
  id: "keywordResearchStep",
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    const targetAge = context.triggerData.targetAge || "小学生全般";
    
    // ラッコキーワードツールを使ってキーワードリサーチを実行
    const keywordResult = await keywordResearcherAgent.generate(`
      「${topic}」について、学童保育・えすこーとサービスの文脈で使えるキーワードを調査してください。
      対象年齢は「${targetAge}」です。
      rakkoKeywordTool を使って関連キーワードを検索し、以下の情報を整理してください：
      
      1. メインキーワード（1-2語）
      2. 関連キーワード（5-8個）
      3. 保護者が検索しそうなフレーズ（3-5個）
      4. 検索ボリュームが高そうなキーワード組み合わせ
    `);
    
    return { keywords: keywordResult.text };
  },
});

// Step 2: コンテンツプランニングのステップ
const plannerStep = new Step({
  id: "contentPlanningStep",
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    const serviceFeature = context.triggerData.serviceFeature || "安全性と学習サポート";
    
    const planResult = await contentPlannerAgent.generate(`
      「${topic}」についての学童えすこーとサービスのブログ記事の構成を作成してください。
      
      以下のキーワード情報を活用してください：
      ${keywords}
      
      特にアピールしたいサービスの特徴：${serviceFeature}
      
      以下の要素を含む詳細な記事構成を作成してください：
      
      1. 魅力的な見出し（H1）
      2. リード文（読者の関心を引く導入部）
      3. 目次構成（H2見出し4-6個）
      4. 各セクションで扱うべき内容の要点
      5. 対象読者が抱える不安や疑問とその解決方法
      6. コールトゥアクション（問い合わせや申し込みを促す文章）
    `);
    
    return { contentPlan: planResult.text };
  },
});

// Step 3: 記事執筆のステップ
const writerStep = new Step({
  id: "blogWritingStep",
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    const contentPlan = context.getStepResult("contentPlanningStep")?.contentPlan;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    
    const articleResult = await blogWriterAgent.generate(`
      以下の構成に基づいて、学童えすこーとサービスについての完全なブログ記事を執筆してください。
      
      トピック：${topic}
      
      コンテンツプラン：
      ${contentPlan}
      
      キーワード情報：
      ${keywords}
      
      記事作成のガイドライン：
      1. 親しみやすく温かみのある文体で書く
      2. 安全性と信頼性を強調する
      3. 具体的なサービス内容や事例を盛り込む
      4. 保護者の不安や懸念に共感し、解決策を提示する
      5. 適切な見出し構造（H1, H2, H3）を使用する
      6. 読みやすい段落構成にする
      7. 自然な形でキーワードを本文に組み込む
      
      完成した記事は、マークダウン形式で出力してください。
    `);
    
    return { draft: articleResult.text };
  },
});

// Step 4: 編集・最適化のステップ
const editorStep = new Step({
  id: "editingStep",
  execute: async ({ context }) => {
    const draft = context.getStepResult("blogWritingStep")?.draft;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    
    const editResult = await editorAgent.generate(`
      以下の学童えすこーとサービスのブログ記事を編集・最適化してください。
      
      元の記事：
      ${draft}
      
      キーワード情報：
      ${keywords}
      
      編集のポイント：
      1. SEO最適化（メタディスクリプション、キーワード配置の確認）
      2. 文章の簡潔化と読みやすさの向上
      3. 説得力を高めるための具体例や数字の追加
      4. 信頼性を高めるための専門的な観点の強化
      5. コールトゥアクションの効果的な配置
      6. 文法や表現の統一性の確認
      
      完成した記事をマークダウン形式で出力してください。メタディスクリプション候補も含めてください。
    `);
    
    return { finalArticle: editResult.text };
  },
});

// ワークフローの構成
escortBlogWorkflow
  .step(keywordStep)
  .then(plannerStep)
  .then(writerStep)
  .then(editorStep)
  .commit(); 