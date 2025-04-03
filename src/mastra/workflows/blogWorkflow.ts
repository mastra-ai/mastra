import { Workflow, Step } from "@mastra/core/workflows";
import { z } from "zod";
import { 
  keywordResearcherAgent,
  contentPlannerAgent, 
  blogWriterAgent, 
  editorAgent
} from "../agents";
import { contentPublisherAgent } from "../agents/contentPublisherAgent";

// 教育ブログ生成ワークフロー
export const escortBlogWorkflow = new Workflow({
  id: "escortBlogWorkflow",
  name: "escortBlogWorkflow",
  triggerSchema: z.object({
    topic: z.string().describe("教育に関連するブログトピック"),
    targetAge: z.string().optional().describe("対象となる年齢層（例：幼児、小学生、中高生、大学生、社会人）"),
    educationLevel: z.string().optional().describe("教育レベル（例：幼児教育、初等教育、中等教育、高等教育、社会人教育）"),
    educationFormat: z.string().optional().describe("教育形態（例：学校教育、オンライン学習、個別指導、グループ学習）"),
    seasonality: z.string().optional().describe("季節性やイベント（例：入学シーズン、試験期間、長期休暇）"),
  }),
});

// Step 1: キーワードリサーチステップ
const keywordStep = new Step({
  id: "keywordResearchStep",
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    const targetAge = context.triggerData.targetAge || "全年齢";
    const educationLevel = context.triggerData.educationLevel || "全教育レベル";
    
    // キーワードリサーチを実行
    const keywordResult = await keywordResearcherAgent.generate(`
      「${topic}」について、教育分野の文脈で使えるキーワードを調査してください。
      対象年齢は「${targetAge}」、教育レベルは「${educationLevel}」です。
      
      以下の情報を整理してください：
      
      1. メインキーワード（1-2語）
      2. 関連キーワード（5-8個）
      3. ユーザー（学習者、保護者、教育者など）が検索しそうなフレーズ（3-5個）
      4. 検索ボリュームが高そうなキーワード組み合わせ
      5. 季節性や時期による検索傾向
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
    const targetAge = context.triggerData.targetAge || "全年齢";
    const educationLevel = context.triggerData.educationLevel || "全教育レベル";
    const educationFormat = context.triggerData.educationFormat || "複合的な学習形態";
    
    const planResult = await contentPlannerAgent.generate(`
      「${topic}」についての教育関連ブログ記事の構成を作成してください。
      
      【計画条件】
      以下のキーワード情報を活用してください：
      ${keywords}
      
      対象年齢：${targetAge}
      教育レベル：${educationLevel}
      教育形態：${educationFormat}
      
      【記事構成要素】
      以下の要素を含む詳細な記事構成を作成してください：
      
      1. 魅力的な見出し（H1）
      2. リード文（読者の関心を引く導入部）
      3. 目次構成（H2見出し4-6個）
      4. 各セクションで扱うべき内容の要点
      5. 対象読者が抱える疑問やニーズとその解決方法
      6. 教育のトレンドや最新の研究知見
      7. 実践的なアドバイスやリソース
      8. コールトゥアクション（次のステップへの促し）
      9. メタディスクリプション案
      
      特に以下の点を意識してください：
      - 読者が真に知りたい情報を提供する
      - エビデンスベースの内容を心がける
      - 情報の流れが論理的かつ自然である
      - 検索意図に合致した内容構成にする
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
    const targetAge = context.triggerData.targetAge || "全年齢";
    const educationLevel = context.triggerData.educationLevel || "全教育レベル";
    
    const articleResult = await blogWriterAgent.generate(`
      以下の構成に基づいて、教育に関する完全なブログ記事を執筆してください。
      
      【記事情報】
      トピック：${topic}
      対象年齢：${targetAge}
      教育レベル：${educationLevel}
      
      【コンテンツプラン】
      ${contentPlan}
      
      【キーワード情報】
      ${keywords}
      
      【記事作成のガイドライン】
      1. 親しみやすく温かみのある文体で書く
      2. 教育的価値と信頼性を強調する
      3. 具体的な事例や教育手法を盛り込む
      4. 読者の疑問や悩みに共感し、解決策を提示する
      5. 適切な見出し構造（H1, H2, H3）を使用する
      6. 読みやすい段落構成にする
      7. 数字やデータを活用して説得力を高める
      8. 教育の専門性を示しつつ、一般読者にも理解しやすい表現を使う
      9. 実践的なアドバイスやリソースを提供する
      
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
    const topic = context.triggerData.topic;
    
    const editResult = await editorAgent.generate(`
      以下の教育関連ブログ記事を編集・最適化してください。
      
      【記事情報】
      トピック：${topic}
      
      【編集対象の記事】
      ${draft}
      
      【キーワード情報】
      ${keywords}
      
      【編集・改善のポイント】
      1. SEO最適化（メタディスクリプション、自然な文章構成）
      2. 文章の簡潔化と読みやすさの向上
      3. 説得力を高めるための具体例やデータの追加
      4. 信頼性を高めるための専門的な観点や研究の引用
      5. コールトゥアクションの効果的な配置
      6. 文法や表現の統一性の確認
      7. 教育トレンドや最新の知見の反映
      8. 実用的なアドバイスの充実
      
      編集した完成版の記事をマークダウン形式で出力してください。
      
      また、以下のSEO情報も含めてください：
      - メタタイトル案
      - メタディスクリプション案
      - 内部リンク提案
      - 画像のalt属性提案
      - スラッグ提案
    `);
    
    return { finalArticle: editResult.text };
  },
});

// Step 5: 公開ステップ
const publishStep = new Step({
  id: "publishingStep",
  execute: async ({ context }) => {
    const article = context.getStepResult("editingStep")?.finalArticle;
    const topic = context.triggerData.topic;
    
    // タイトルを抽出（マークダウンから最初の # 行を取得）
    const titleMatch = article.match(/^#\s(.+)$/m);
    const title = titleMatch ? titleMatch[1] : topic;
    
    // メタディスクリプションを生成（最初の数行を使用）
    const firstParagraph = article.split('\n\n')[1] || '';
    const metaDescription = firstParagraph.substring(0, 155) + '...';
    
    const publishResult = await contentPublisherAgent.generate(`
      以下の教育関連ブログ記事をデータベースに保存し、WordPressに投稿してください。
      
      【記事情報】
      タイトル：${title}
      
      【記事内容】
      ${article}
      
      【公開指示】
      1. カテゴリーは記事の内容に応じて以下から最適なものを選択してください：
         - 幼児教育
         - 初等教育
         - 中等教育
         - 高等教育
         - オンライン学習
         - 学習法
         - 教育リソース
         - 教育トレンド
         - 学習環境
      
      2. 記事をWordPressに「下書き」として投稿してください
      
      3. 以下のSEO情報を設定してください：
         - メタタイトル：${title} | 教育ブログ
         - メタディスクリプション：${metaDescription}
         - フォーカスキーワード：${topic}
      
      4. 適切なタグを5つ程度設定してください
      
      処理結果を報告してください。WordPressの記事URL、ステータス、設定したカテゴリーやタグなどを含めてください。
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