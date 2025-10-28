---
title: "リファレンス: ExtractParams"
description: Mastra のメタデータ抽出設定に関するドキュメント。
---

# ExtractParams \{#extractparams\}

ExtractParams は、LLM による分析でドキュメントのチャンクからメタデータを抽出するための設定です。

## 例 \{#example\}

```typescript showLineNumbers copy
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromText(text);
const chunks = await doc.chunk({
  extract: {
    title: true, // デフォルト設定でタイトルを抽出
    summary: true, // デフォルト設定で要約を生成
    keywords: true, // デフォルト設定でキーワードを抽出
  },
});

// 出力例:
// chunks[0].metadata = {
//   documentTitle: "AI Systems Overview",
//   sectionSummary: "人工知能の概念と応用の概要",
//   excerptKeywords: "KEYWORDS: AI, machine learning, algorithms"
// }
```

## パラメータ \{#parameters\}

`extract` パラメータは次のフィールドを受け付けます:

<PropertiesTable
  content={[
{
name: "title",
type: "boolean | TitleExtractorsArgs",
isOptional: true,
description:
"タイトル抽出を有効にします。既定の設定を使う場合は true を設定するか、カスタム設定を指定してください。",
},
{
name: "summary",
type: "boolean | SummaryExtractArgs",
isOptional: true,
description:
"要約抽出を有効にします。既定の設定を使う場合は true を設定するか、カスタム設定を指定してください。",
},
{
name: "questions",
type: "boolean | QuestionAnswerExtractArgs",
isOptional: true,
description:
"質問の生成を有効にします。既定の設定を使う場合は true を設定するか、カスタム設定を指定してください。",
},
{
name: "keywords",
type: "boolean | KeywordExtractArgs",
isOptional: true,
description:
"キーワード抽出を有効にします。既定の設定を使う場合は true を設定するか、カスタム設定を指定してください。",
},
]}
/>

## Extractor の引数 \{#extractor-arguments\}

### TitleExtractorsArgs \{#titleextractorsargs\}

<PropertiesTable
  content={[
{
name: "llm",
type: "MastraLanguageModel",
isOptional: true,
description: "タイトル抽出に使用する AI SDK の言語モデル",
},
{
name: "nodes",
type: "number",
isOptional: true,
description: "抽出するタイトルノード数",
},
{
name: "nodeTemplate",
type: "string",
isOptional: true,
description:
"タイトルノード抽出用のカスタムプロンプトテンプレート。{context} プレースホルダーを必ず含めてください",
},
{
name: "combineTemplate",
type: "string",
isOptional: true,
description:
"タイトルを統合するためのカスタムプロンプトテンプレート。{context} プレースホルダーを必ず含めてください",
},
]}
/>

### SummaryExtractArgs \{#summaryextractargs\}

<PropertiesTable
  content={[
{
name: "llm",
type: "MastraLanguageModel",
isOptional: true,
description: "要約抽出に使用する AI SDK の言語モデル",
},
{
name: "summaries",
type: "('self' | 'prev' | 'next')[]",
isOptional: true,
description:
"生成する要約タイプのリスト。含められるのは 'self'（現在のチャンク）、'prev'（前のチャンク）、または 'next'（次のチャンク）のみです",
},
{
name: "promptTemplate",
type: "string",
isOptional: true,
description:
"要約生成用のカスタムプロンプトテンプレート。{context} プレースホルダーを必ず含めてください",
},
]}
/>

### QuestionAnswerExtractArgs \{#questionanswerextractargs\}

<PropertiesTable
  content={[
{
name: "llm",
type: "MastraLanguageModel",
isOptional: true,
description: "質問生成に使用する AI SDK の言語モデル",
},
{
name: "questions",
type: "number",
isOptional: true,
description: "生成する質問数",
},
{
name: "promptTemplate",
type: "string",
isOptional: true,
description:
"質問生成用のカスタムプロンプトテンプレート。{context} と {numQuestions} の両方のプレースホルダーを含める必要があります。",
},
{
name: "embeddingOnly",
type: "boolean",
isOptional: true,
description: "true の場合、実際の質問は生成せず、埋め込みのみを生成します",
},
]}
/>

### KeywordExtractArgs \{#keywordextractargs\}

<PropertiesTable
  content={[
{
name: "llm",
type: "MastraLanguageModel",
isOptional: true,
description: "キーワード抽出に使用するAI SDKの言語モデル",
},
{
name: "keywords",
type: "number",
isOptional: true,
description: "抽出するキーワード数",
},
{
name: "promptTemplate",
type: "string",
isOptional: true,
description:
"キーワード抽出用のカスタムプロンプトテンプレート。{context} と {maxKeywords} の両方のプレースホルダーを含める必要があります。",
},
]}
/>

## 応用例 \{#advanced-example\}

```typescript showLineNumbers copy
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromText(text);
const chunks = await doc.chunk({
  extract: {
    // カスタム設定でタイトルを抽出
    title: {
      nodes: 2, // タイトルノードを2つ抽出
      nodeTemplate: 'これに対してタイトルを生成: {context}',
      combineTemplate: 'これらのタイトルを結合: {context}',
    },

    // カスタム設定で要約を抽出
    summary: {
      summaries: ['self'], // 現在のチャンクの要約を生成
      promptTemplate: 'これを要約: {context}',
    },

    // カスタム設定で質問を生成
    questions: {
      questions: 3, // 質問を3つ生成
      promptTemplate: '{context}について{numQuestions}個の質問を生成: {context}',
      embeddingOnly: false,
    },

    // カスタム設定でキーワードを抽出
    keywords: {
      keywords: 5, // キーワードを5つ抽出
      promptTemplate: '{context}から{maxKeywords}個の重要な用語を抽出: {context}',
    },
  },
});

// 出力例:
// chunks[0].metadata = {
//   documentTitle: "現代コンピューティングにおけるAI",
//   sectionSummary: "AIの概念とコンピューティングにおける応用の概要",
//   questionsThisExcerptCanAnswer: "1. 機械学習とは何ですか?\n2. ニューラルネットワークはどのように動作しますか?",
//   excerptKeywords: "1. 機械学習\n2. ニューラルネットワーク\n3. トレーニングデータ"
// }
```

## タイトル抽出のためのドキュメントのグルーピング \{#document-grouping-for-title-extraction\}

`TitleExtractor` を使用する場合、各チャンクの `metadata` フィールドで共通の `docId` を指定すると、複数のチャンクをまとめてタイトル抽出できます。同じ `docId` を持つすべてのチャンクには、同じ抽出タイトルが付与されます。`docId` が設定されていない場合、各チャンクはタイトル抽出において個別のドキュメントとして扱われます。

**例:**

```ts
import { MDocument } from '@mastra/rag';

const doc = new MDocument({
  docs: [
    { text: 'chunk 1', metadata: { docId: 'docA' } },
    { text: 'chunk 2', metadata: { docId: 'docA' } },
    { text: 'chunk 3', metadata: { docId: 'docB' } },
  ],
  type: 'text',
});

await doc.extractMetadata({ title: true });
// 最初の2つのチャンクは同じタイトルを共有し、3つ目のチャンクには別のタイトルが割り当てられます。
```
