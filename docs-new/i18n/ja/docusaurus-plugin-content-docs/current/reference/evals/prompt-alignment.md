---
title: "リファレンス：プロンプト整合性"
description: Mastra の「プロンプト整合性」指標に関するドキュメント。LLM の出力が与えられたプロンプトの指示にどの程度従っているかを評価します。
---

# PromptAlignmentMetric \{#promptalignmentmetric\}

:::info 新しい Scorer API

私たちは、Scorers と呼ばれる新しい評価用 API をリリースしました。より使いやすい API、エラー分析のためのより多くのメタデータ、そしてデータ構造を評価するための高い柔軟性を備えています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`PromptAlignmentMetric` クラスは、LLM の出力が与えられたプロンプトの指示にどれだけ厳密に従っているかを評価します。各指示が正確に守られているかを判定するジャッジ方式を用い、逸脱がある場合にはその理由を詳細に提示します。

## 基本的な使用方法 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { PromptAlignmentMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const instructions = ['文は大文字で始める', '各文はピリオドで終わる', '現在形を使用する'];

const metric = new PromptAlignmentMetric(model, {
  instructions,
  scale: 1,
});

const result = await metric.measure(
  '天気を説明してください',
  '太陽が輝いています。雲が空に浮かんでいます。穏やかな風が吹いています。',
);

console.log(result.score); // 0から1までのアライメントスコア
console.log(result.info.reason); // スコアの説明
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
description:
"指示整合性の評価に使用するモデルの設定",
isOptional: false,
},
{
name: "options",
type: "PromptAlignmentOptions",
description: "指標の設定オプション",
isOptional: false,
},
]}
/>

### PromptAlignmentOptions \{#promptalignmentoptions\}

<PropertiesTable
  content={[
{
name: "instructions",
type: "string[]",
description: "出力が従うべき指示の配列",
isOptional: false,
},
{
name: "scale",
type: "number",
description: "最大スコア",
isOptional: true,
defaultValue: "1",
},
]}
/>

## measure() のパラメータ \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "元のプロンプトまたはクエリ",
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

## 返却値 \{#returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "アラインメントスコア（0 からスケール上、既定は 0〜1）",
},
{
name: "info",
type: "object",
description:
"指示遵守に関する詳細なメトリクスを含むオブジェクト",
properties: [
{
type: "string",
parameters: [
{
name: "reason",
type: "string",
description:
"スコアおよび指示遵守に関する詳細な説明",
},
],
},
],
},
]}
/>

## 採点の詳細 \{#scoring-details\}

このメトリックは、以下の観点から指示への整合性を評価します：

* 各指示の適用可否の判断
* 該当する指示に対する厳格な遵守の評価
* すべての判定に関する詳細な理由付け
* 該当する指示数に応じた比例配点

### インストラクションの判定 \{#instruction-verdicts\}

各インストラクションには、次のいずれかの判定が付与されます：

* &quot;yes&quot;: インストラクションは適用可能で、完全に順守されている
* &quot;no&quot;: インストラクションは適用可能だが、順守されていない、または一部のみ順守されている
* &quot;n/a&quot;: インストラクションは与えられた文脈には適用されない

### スコアリングプロセス \{#scoring-process\}

1. 指示の適用可否を評価:
   * 各指示が文脈に適用可能かを判定
   * 無関係な指示は「n/a」とする
   * ドメイン固有の要件を考慮

2. 適用可能な指示の順守状況を評価:
   * 各適用可能な指示を独立に評価
   * 「yes」の判定には完全な順守が必要
   * すべての判定に具体的な根拠を記録

3. アラインメントスコアを算出:
   * 順守された指示（「yes」判定）を数える
   * 適用可能な指示の総数で割る（「n/a」は除外）
   * 設定された範囲にスケーリングする

最終スコア: `(followed_instructions / applicable_instructions) * scale`

### 重要な考慮事項 \{#important-considerations\}

* 空の出力:
  * すべての書式設定に関する指示は適用可能とみなす
  * 要件を満たせないため「no」としてマークする
* ドメイン固有の指示:
  * 問い合わせたドメインに関する場合は常に適用可能
  * 従わなかった場合は「n/a」ではなく「no」としてマークする
* 「n/a」の判定:
  * 完全に異なるドメインの場合にのみ使用
  * 最終スコアの計算には影響しない

### スコアの解釈 \{#score-interpretation\}

（スケールは0から。既定は0〜1）

* 1.0：該当する指示を完全に順守
* 0.7〜0.9：該当する指示のほとんどを順守
* 0.4〜0.6：該当する指示の順守状況がまちまち
* 0.1〜0.3：該当する指示の順守が限定的
* 0.0：該当する指示をまったく順守していない

## 分析付きの例 \{#example-with-analysis\}

```typescript
import { openai } from "@ai-sdk/openai";
import { PromptAlignmentMetric } from "@mastra/evals/llm";

// 評価用のモデルを設定
const model = openai("gpt-4o-mini");

const metric = new PromptAlignmentMetric(model, {
  instructions: [
    "各項目に箇条書きを使用する",
    "正確に3つの例を含める",
    "各項目の末尾にセミコロンを付ける"
  ],
  scale: 1
});

const result = await metric.measure(
  "3つの果物をリストアップ",
  "• リンゴは赤くて甘い;
• バナナは黄色くて曲がっている;
• オレンジは柑橘類で丸い。"
);

// 出力例:
// {
//   score: 1.0,
//   info: {
//     reason: "スコアは1.0です。すべての指示が正確に守られているためです:
//           箇条書きが使用され、正確に3つの例が提供され、
//           各項目の末尾にセミコロンが付いています。"
//   }
// }

const result2 = await metric.measure(
  "3つの果物をリストアップ",
  "1. リンゴ
2. バナナ
3. オレンジとブドウ"
);

// 出力例:
// {
//   score: 0.33,
//   info: {
//     reason: "スコアは0.33です。理由は次の通りです:箇条書きの代わりに番号付きリストが使用され、
//           セミコロンが使用されておらず、正確に3つではなく4つの果物がリストアップされています。"
//   }
// }
```

## 関連項目 \{#related\}

* [回答の関連性メトリクス](./answer-relevancy)
* [キーワード網羅性メトリクス](./keyword-coverage)