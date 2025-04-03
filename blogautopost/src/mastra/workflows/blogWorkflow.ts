import { Workflow, Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { 
  keywordResearcherAgent, 
  contentPlannerAgent, 
  blogWriterAgent, 
  editorAgent,
  contentPublisherAgent
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

// Step 4: 編集ステップ
const editorStep = new Step({
  id: "editingStep",
  execute: async ({ context }) => {
    const draft = context.getStepResult("blogWritingStep")?.draft;
    const topic = context.triggerData.topic;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    
    const editResult = await editorAgent.generate(`
      以下のブログ記事を編集・改善してください。
      
      【記事情報】
      トピック：${topic}
      
      【キーワード情報】
      ${keywords}
      
      【編集対象の記事】
      ${draft}
      
      【編集・改善のポイント】
      1. SEOの最適化（キーワードの適切な配置と密度）
      2. 読みやすさの向上（文章構造、段落分け）
      3. 内容の充実と正確性
      4. 論理的な流れの改善
      5. 文法・誤字脱字の修正
      6. 保護者目線での不安解消ポイントの強化
      7. えすこーとサービスの具体的メリットの強調
      8. 行動喚起（CTA）の明確化
      
      編集した完成版の記事をマークダウン形式で出力してください。
    `);
    
    return { final_article: editResult.text };
  },
});

// Step 5: データベース保存とWordPress投稿ステップ
const publishStep = new Step({
  id: "publishingStep",
  execute: async ({ context }) => {
    const article = context.getStepResult("editingStep")?.final_article;
    const topic = context.triggerData.topic;
    const keywords = context.getStepResult("keywordResearchStep")?.keywords;
    
    // タイトルを抽出（マークダウンから最初の # 行を取得）
    const titleMatch = article.match(/^#\s(.+)$/m);
    const title = titleMatch ? titleMatch[1] : topic;
    
    // メタディスクリプションを生成（最初の数行を使用）
    const firstParagraph = article.split('\n\n')[1] || '';
    const metaDescription = firstParagraph.substring(0, 155) + '...';
    
    const publishResult = await contentPublisherAgent.generate(`
      以下のブログ記事をSupabaseデータベースに保存し、WordPressに投稿してください。
      
      【記事情報】
      タイトル：${title}
      キーワード：${keywords}
      
      【記事内容】
      ${article}
      
      【公開指示】
      1. 【注意：SupabaseとWordPressのカテゴリーIDは異なります】
         a. Supabaseデータベースに保存する際は、以下のカテゴリーIDを使用してください：
            - ID: 2（「学童保育」）を最優先で使用
            - ID: 1（「General」）を代替として使用
         b. WordPressに投稿する際は、以下のカテゴリーIDを使用してください：
            - ID: 10（「小学校」）を最優先で使用
            - ID: 1（「未分類」）を代替として使用
      
      2. 最初にgetCategoriesツールを使ってSupabaseのカテゴリー一覧を取得し、実際に存在するIDを確認してください
      3. 確認したカテゴリーIDを使って記事をSupabaseデータベースに保存してください
      4. 次に記事をWordPressに「下書き」として投稿してください（WordPressカテゴリーID: 10）
      5. 以下のSEO情報を設定してください：
         - メタタイトル：${title} | プリエスコート公式ブログ
         - メタディスクリプション：${metaDescription}
         - フォーカスキーワード：${keywords.split(',')[0] || topic}
      
      注意:
      - **新しいカテゴリーを作成しないでください** - 権限エラーが発生します
      - データベース操作やWordPress投稿でエラーが発生した場合は、エラーの詳細を報告してください
      - **重要：SupabaseとWordPressで同じカテゴリーIDを使用しないでください。必ずgetCategoriesでSupabaseのIDを確認してから使用してください**
      
      処理結果を報告してください。WordPressの記事URL、ステータス、DBへの保存結果などを含めてください。
    `);
    
    return { 
      title: title,
      publishing_result: publishResult.text 
    };
  },
});

// ワークフローの構成
escortBlogWorkflow
  .step(keywordStep)
  .then(plannerStep)
  .then(writerStep)
  .then(editorStep)
  .then(publishStep)
  .commit(); 