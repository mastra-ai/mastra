---
title: "実世界の国々"
description: カスタムのLLMベースの評価指標を作成する例。
---

# 判定者としての LLM 評価 \{#llm-as-a-judge-evaluation\}

:::info 新しい Scorer API

新しい評価用 API「Scorers」をリリースしました。より扱いやすい API、エラー分析向けのより豊富なメタデータ、そしてデータ構造を柔軟に評価できる機能を備えています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

この例では、世界の実在する国を判定するためのカスタムの LLM ベース評価指標の作成方法を示します。この指標は `query` と `response` を受け取り、応答がクエリにどれだけ正確に合致しているかに基づいてスコアと理由を返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## カスタム eval を作成する \{#create-a-custom-eval\}

Mastra のカスタム eval は、構造化されたプロンプトと評価基準に基づき、LLM を使って応答の品質を判定できます。これは次の4つの中核コンポーネントで構成されます:

1. [**Instructions**](#eval-instructions)
2. [**Prompt**](#eval-prompt)
3. [**Judge**](#eval-judge)
4. [**Metric**](#eval-metric)

これらを組み合わせることで、Mastra の組み込みメトリクスではカバーされない場合のあるカスタム評価ロジックを定義できます。

```typescript filename="src/mastra/evals/example-real-world-countries.ts" showLineNumbers copy
import { Metric, type MetricResult } from '@mastra/core';
import { MastraAgentJudge } from '@mastra/evals/judge';
import { type LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

const INSTRUCTIONS = `あなたは地理の専門家です。元の質問に基づいて、回答に記載されている有効な国がいくつあるかスコアを付けてください。`;

const generatePrompt = (query: string, response: string) => `

質問:「${query}」
回答:「${response}」

回答に記載されている有効な実在の国がいくつあるか評価してください。

返却値:
{
  "score": number (0 to 1),
  "info": {
    "reason": 文字列,
    "matches": [文字列, 文字列],
    "misses": [文字列]
  }
}
`;

class WorldCountryJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('WorldCountryJudge', INSTRUCTIONS, model);
  }

  async evaluate(query: string, response: string): Promise<MetricResult> {
    const prompt = generatePrompt(query, response);
    const result = await this.agent.generate(prompt, {
      structuredOutput: {
        schema: z.object({
          score: z.number().min(0).max(1),
          info: z.object({
            reason: z.string(),
            matches: z.array(z.string()),
            misses: z.array(z.string()),
          }),
        }),
      },
      maxSteps: 1,
    });

    return result.object;
  }
}

export class WorldCountryMetric extends Metric {
  judge: WorldCountryJudge;

  constructor(model: LanguageModel) {
    super();
    this.judge = new WorldCountryJudge(model);
  }

  async measure(query: string, response: string): Promise<MetricResult> {
    return this.judge.evaluate(query, response);
  }
}
```

### 評価手順 \{#eval-instructions\}

判定者の役割を定義し、LLM が回答をどのように評価すべきかの期待値を設定します。

### 評価プロンプト \{#eval-prompt\}

`query` と `response` を用いて一貫性のある評価用プロンプトを作成し、LLM が `score` と構造化された `info` オブジェクトを返すように促します。

### Eval judge \{#eval-judge\}

`MastraAgentJudge` を拡張し、プロンプト生成とスコアリングを管理します。

* `generatePrompt()` は、指示とクエリ、レスポンスを組み合わせてプロンプトを生成します。
* `evaluate()` は、プロンプトを LLM に送信し、Zod スキーマで出力を検証します。
* 数値の `score` と、カスタマイズ可能な `info` オブジェクトを含む `MetricResult` を返します。

### 評価メトリック \{#eval-metric\}

Mastra の `Metric` クラスを拡張し、評価の主要なエントリーポイントとして機能します。ジャッジを用いて `measure()` で結果を算出し、返します。

## 高度にカスタム化された例 \{#high-custom-example\}

この例は、応答が評価基準にしっかり一致していることを示しています。評価指標は高得点を付与し、出力が期待を満たしている理由を説明するための根拠となる詳細も示します。

```typescript filename="src/example-high-real-world-countries.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { WorldCountryMetric } from './mastra/evals/example-real-world-countries';

const metric = new WorldCountryMetric(openai('gpt-4o-mini'));

const query = '世界の国をいくつか挙げてください。';
const response = 'フランス、日本、アルゼンチン';

const result = await metric.measure(query, response);

console.log(result);
```

### カスタム出力（高評価） \{#high-custom-output\}

この出力は、レスポンスの内容が審査基準に完全に合致しているため高得点となります。`info` オブジェクトは、そのスコアが付与された理由を理解するうえで役立つ有益なコンテキストを提供します。

```typescript
{
  score: 1,
  info: {
    reason: 'リストされているすべての国は、世界で認められている有効な国です。',
    matches: [ 'France', 'Japan', 'Argentina' ],
    misses: []
  }
}
```

## 部分的なカスタム例 \{#partial-custom-example\}

この例では、レスポンスに正しい要素と誤った要素が混在しています。メトリクスはそれを反映して中間的なスコアを返し、何が正しく、何が見落とされたのかを説明する詳細を示します。

```typescript filename="src/example-partial-real-world-countries.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { WorldCountryMetric } from './mastra/evals/example-real-world-countries';

const metric = new WorldCountryMetric(openai('gpt-4o-mini'));

const query = '世界の国をいくつか挙げてください。';
const response = 'ドイツ、ナルニア、オーストラリア';

const result = await metric.measure(query, response);

console.log(result);
```

### 部分的なカスタム出力 \{#partial-custom-output\}

スコアは部分的な成功を反映しています。これは、応答に基準を満たす有効な項目と、満たさない無効な項目の両方が含まれているためです。`info` フィールドには、何が一致し、何が一致しなかったかの内訳が示されています。

```typescript
{
  score: 0.67,
  info: {
    reason: 'リストされた3つのうち2つが有効な国です。',
    matches: [ 'Germany', 'Australia' ],
    misses: [ 'Narnia' ]
  }
}
```

## カスタムの低評価例 \{#low-custom-example\}

この例では、応答が評価基準をまったく満たしていません。期待される要素が一切含まれていないため、指標は低いスコアを返します。

```typescript filename="src/example-low-real-world-countries.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { WorldCountryMetric } from './mastra/evals/example-real-world-countries';

const metric = new WorldCountryMetric(openai('gpt-4o-mini'));

const query = '世界の国をいくつか挙げてください。';
const response = 'ゴッサム、ワカンダ、アトランティス';

const result = await metric.measure(query, response);

console.log(result);
```

### カスタム出力が低い \{#low-custom-output\}

スコアは0です。これは応答に必須要素が一切含まれていないためです。`info` フィールドでは、結果の理由を説明し、この結果につながった不足点を列挙しています。

```typescript
{
  score: 0,
  info: {
    reason: '応答には実在の国ではなく架空の場所が含まれています。',
    matches: [],
    misses: [ 'Gotham', 'Wakanda', 'Atlantis' ]
  }
}
```

## 結果の理解 \{#understanding-the-results\}

`WorldCountryMetric` は次の形の結果を返します:

```typescript
{
  score: number,
  info: {
    reason: string,
    matches: string[],
    misses: string[]
  }
}
```

### カスタムスコア \{#custom-score\}

0〜1の範囲のスコア:

* **1.0**: 応答は誤りのない有効な項目のみを含む。
* **0.7〜0.9**: 応答は概ね正しいが、1〜2件の誤った項目を含む場合がある。
* **0.4〜0.6**: 応答は有効な項目と無効な項目が混在している。
* **0.1〜0.3**: 応答は主に誤りや無関係な項目を含む。
* **0.0**: 評価基準に照らして有効な内容を一切含まない。

### カスタム情報 \{#custom-info\}

スコアの説明で、次の内容を含みます:

* 結果についての平易な説明。
* レスポンス内で見つかった正しい要素を列挙する `matches` 配列。
* 誤っている、または基準を満たしていない項目を示す `misses` 配列。

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/custom-eval" />