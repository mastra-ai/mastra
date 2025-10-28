---
title: "リファレンス：Contextual Recall"
description: 関連コンテキストの反映度に基づき、LLMの応答がどれだけ完全に必要な情報を取り込めているかを評価する「Contextual Recall」指標のドキュメント。
---

# ContextualRecallMetric \{#contextualrecallmetric\}

:::info New Scorer API

新しい評価用API「Scorers」をリリースしました。より使いやすいAPI、エラー分析のための豊富なメタデータ、そしてデータ構造を評価するための柔軟性を備えています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ContextualRecallMetric` クラスは、提供されたコンテキストの関連情報を、LLM の応答にどれだけ効果的に取り入れられているかを評価します。参照ドキュメントの重要な情報が応答にきちんと含まれているかを測定し、精度ではなく網羅性に重点を置きます。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextualRecallMetric } from '@mastra/evals/llm';

// 評価用のモデルを構成する
const model = openai('gpt-4o-mini');

const metric = new ContextualRecallMetric(model, {
  context: [
    '製品の特長: クラウド同期機能',
    'すべてのユーザーが利用可能なオフラインモード',
    '複数デバイスの同時利用をサポート',
    'すべてのデータを対象としたエンドツーエンド暗号化',
  ],
});

const result = await metric.measure(
  '製品の主な特長は何ですか？',
  'この製品にはクラウド同期、オフラインモード、マルチデバイス対応が含まれています。',
);

console.log(result.score); // スコア（0〜1）
```

## コンストラクター引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
description:
"コンテキスト再現率の評価に用いるモデルの構成",
isOptional: false,
},
{
name: "options",
type: "ContextualRecallMetricOptions",
description: "メトリクスの構成オプション",
isOptional: false,
},
]}
/>

### ContextualRecallMetricOptions \{#contextualrecallmetricoptions\}

<PropertiesTable
  content={[
{
name: "scale",
type: "number",
description: "スコアの最大値",
isOptional: true,
defaultValue: "1",
},
{
name: "context",
type: "string[]",
description:
"照合対象となる参照ドキュメントまたは情報の配列",
isOptional: false,
},
]}
/>

## measure() のパラメータ \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "元のクエリまたはプロンプト",
isOptional: false,
},
{
name: "output",
type: "string",
description: "評価対象のLLMの応答",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "再現率スコア（0 からスケール、デフォルトは 0～1）",
},
{
name: "info",
type: "object",
description: "スコアの理由を含むオブジェクト",
properties: [
{
type: "string",
parameters: [
{
name: "reason",
type: "string",
description: "スコアに関する詳細な説明",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

このメトリクスは、応答内容を関連するコンテキスト項目と照合して、リコール（再現率）を評価します。

### スコアリングプロセス \{#scoring-process\}

1. 想起情報の評価:
   * 文脈内の関連項目を特定
   * 正しく想起された情報を記録
   * 想起の網羅性を測定

2. 想起スコアの算出:
   * 正しく想起された項目数を集計
   * 総関連項目数と比較
   * カバレッジ率を計算

最終スコア: `(correctly_recalled_items / total_relevant_items) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、デフォルトは0～1）

* 1.0：完全に想起できている — すべての関連情報を含む
* 0.7～0.9：高い想起 — ほとんどの関連情報を含む
* 0.4～0.6：中程度の想起 — 一部の関連情報を見落としている
* 0.1～0.3：低い想起 — 重要な情報を見落としている
* 0.0：想起なし — 関連情報を含まない

## カスタム設定の例 \{#example-with-custom-configuration\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextualRecallMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new ContextualRecallMetric(model, {
  scale: 100, // 0-1スケールではなく0-100スケールを使用
  context: [
    'すべてのデータは保存時および転送時に暗号化される',
    '二要素認証(2FA)は必須',
    '定期的なセキュリティ監査を実施',
    'インシデント対応チームが24時間365日対応',
  ],
});

const result = await metric.measure(
  "会社のセキュリティ対策を要約してください",
  '当社はデータ保護のために暗号化を実装し、すべてのユーザーに2FAを必須としています。',
);

// 出力例:
// {
//   score: 50, // セキュリティ対策の半分のみが言及された
//   info: {
//     reason: "スコアが50なのは、回答でセキュリティ対策の半分のみが言及されたためです。
//           回答には定期的なセキュリティ監査とインシデント対応チームの
//           情報が含まれていませんでした。"
//   }
// }
```

## 関連項目 \{#related\}

* [コンテキスト関連度指標](./context-relevancy)
* [完全性指標](./completeness)
* [要約指標](./summarization)