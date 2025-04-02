import { Workflow, Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { 
  keywordResearcherAgent, 
  contentPlannerAgent, 
  blogWriterAgent, 
  editorAgent 
} from '../agents';

// 学童えすこーと専用ブログ生成ワークフロー（改善版）
export const escortBlogWorkflow = new Workflow({
  name: "escort-blog-workflow",
  triggerSchema: z.object({
    topic: z.string().describe("学童えすこーとサービスに関連するブログトピック"),
    targetAge: z.string().optional().describe("対象となる子どもの年齢層（例：低学年、高学年、全学年）"),
    serviceFeature: z.string().optional().describe("アピールしたいサービスの特徴（例：送迎、習い事、学習支援）"),
    targetAudience: z.string().optional().describe("主なターゲット層（例：共働き家庭、転勤の多い家庭）"),
    seasonality: z.string().optional().describe("季節性やイベント（例：夏休み、冬休み、新学期）"),
  }),
});

// Step 1: キーワードリサーチのステップ（改善版）
const keywordStep = new Step({
  id: "keywordResearchStep",
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    const targetAge = context.triggerData.targetAge || "小学生全般";
    const serviceFeature = context.triggerData.serviceFeature || "総合的なサービス";
    const targetAudience = context.triggerData.targetAudience || "共働き家庭";
    const seasonality = context.triggerData.seasonality || "通年";
    
    // ラッコキーワードツールを使ってキーワードリサーチを実行
    const keywordResult = await keywordResearcherAgent.generate(`
      「${topic}」について、学童保育・えすこーとサービスの文脈で使えるキーワードを調査してください。

      【調査条件】
      - 対象年齢：「${targetAge}」
      - アピールしたいサービス特徴：「${serviceFeature}」
      - ターゲット層：「${targetAudience}」
      - 季節性：「${seasonality}」

      rakkoKeywordTool を使って関連キーワードを検索し、以下の情報を整理してください：
      
      1. メインキーワード（1-2語）
      2. 関連キーワード（5-8個）
      3. 保護者が検索しそうなフレーズ（3-5個）
      4. 検索ボリュームが高そうなキーワード組み合わせ
      5. SEO戦略の提案
    `);
    
    return { keywords: keywordResult.text };
  },
});

// Step 2: コンテンツプランニングのステップ（改善版）
const plannerStep = new Step({
  id: "contentPlanningStep",
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    const serviceFeature = context.triggerData.serviceFeature || "安全性と学習サポート";
    const targetAge = context.triggerData.targetAge || "小学生全般";
    const targetAudience = context.triggerData.targetAudience || "共働き家庭";
    const seasonality = context.triggerData.seasonality || "通年";
    
    const planResult = await contentPlannerAgent.generate(`
      「${topic}」についての学童えすこーとサービスのブログ記事の構成を作成してください。
      
      【記事作成条件】
      - キーワード情報：
      ${keywords}
      
      - 特にアピールしたいサービスの特徴：${serviceFeature}
      - 対象年齢：${targetAge}
      - 主なターゲット層：${targetAudience}
      - 季節性：${seasonality}
      
      以下の要素を含む詳細な記事構成を作成してください：
      
      1. 魅力的な見出し（H1）
      2. リード文（読者の関心を引く導入部）
      3. 目次構成（H2見出し4-6個）
      4. 各セクションで扱うべき内容の要点
      5. 対象読者が抱える不安や疑問とその解決方法
      6. コールトゥアクション（問い合わせや申し込みを促す文章）
      7. メタディスクリプション案
      
      特に以下の点を意識してください：
      - 保護者が真に知りたい情報を提供する
      - えすこーとの独自の強みを際立たせる
      - 情報の流れが論理的かつ自然である
      - 検索意図に合致した内容構成にする
    `);
    
    return { contentPlan: planResult.text };
  },
});

// Step 3: 記事執筆のステップ（改善版）
const writerStep = new Step({
  id: "blogWritingStep",
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    const contentPlan = context.getStepResult("contentPlanningStep")?.contentPlan;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    const serviceFeature = context.triggerData.serviceFeature || "安全性と学習サポート";
    const targetAge = context.triggerData.targetAge || "小学生全般";
    const targetAudience = context.triggerData.targetAudience || "共働き家庭";
    
    const articleResult = await blogWriterAgent.generate(`
      以下の構成に基づいて、学童えすこーとサービスについての完全なブログ記事を執筆してください。
      
      【記事情報】
      トピック：${topic}
      アピールしたいサービスの特徴：${serviceFeature}
      対象年齢：${targetAge}
      主なターゲット層：${targetAudience}
      
      【コンテンツプラン】
      ${contentPlan}
      
      【キーワード情報】
      ${keywords}
      
      【記事作成のガイドライン】
      1. 親しみやすく温かみのある文体で書く
      2. 安全性と信頼性を強調する
      3. 具体的なサービス内容や事例を盛り込む
      4. 保護者の不安や懸念に共感し、解決策を提示する
      5. 適切な見出し構造（H1, H2, H3）を使用する
      6. 読みやすい段落構成にする
      7. 自然な形でキーワードを本文に組み込む
      8. 数字やデータを活用して説得力を高める
      9. えすこーと独自のサービスや強みを具体的に紹介する
      10. コールトゥアクションを効果的に配置する
      
      完成した記事は、マークダウン形式で出力してください。
    `);
    
    return { draft: articleResult.text };
  },
});

// Step 4: 編集・最適化のステップ（改善版）
const editorStep = new Step({
  id: "editingStep",
  execute: async ({ context }) => {
    const draft = context.getStepResult("blogWritingStep")?.draft;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    const contentPlan = context.getStepResult("contentPlanningStep")?.contentPlan;
    const topic = context.triggerData.topic;
    
    const editResult = await editorAgent.generate(`
      以下の学童えすこーとサービスのブログ記事を編集・最適化してください。
      
      【元の記事】
      ${draft}
      
      【キーワード情報】
      ${keywords}
      
      【コンテンツプラン】
      ${contentPlan}
      
      【トピック】
      ${topic}
      
      【編集のポイント】
      1. SEO最適化
         - メタディスクリプション、キーワード配置の確認
         - 内部リンクの提案
         - 画像のalt属性の提案
         - 推奨URLスラッグの提案
      
      2. 読みやすさの向上
         - 文章の簡潔化と読みやすさの向上
         - 専門用語の平易な説明
         - 段落構成の最適化
         - 一貫したトーン
      
      3. 説得力の強化
         - 具体例や数字の追加
         - 専門的な観点の強化
         - コールトゥアクションの効果的な配置
         - 文法や表現の統一性

      4. 安全対策と教育価値の強調
         - 安全対策の具体的な記述の確認
         - 教育プログラムの価値説明の確認
         - 保護者の不安解消ポイントの確認
      
      完成した記事をマークダウン形式で出力し、メタディスクリプション候補、推奨URL、内部リンク提案、
      画像alt属性案、キーワード配置状況、編集者コメントも含めてください。
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