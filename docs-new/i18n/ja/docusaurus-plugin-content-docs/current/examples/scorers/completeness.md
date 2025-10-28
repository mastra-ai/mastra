---
title: "完全性"
description: クエリのすべての側面に対して、回答がどれほど網羅的に対応しているかを評価するための Completeness スコアラーの使用例。
---

# 完全性スコアラー \{#completeness-scorer\}

`createCompletenessScorer` を使用して、応答が入力クエリのすべての側面と要件を網羅的に満たしているかを評価します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の完全なドキュメントと構成オプションについては、[`createCompletenessScorer`](/docs/reference/scorers/completeness) を参照してください。

## 完成度の高い例 \{#high-completeness-example\}

この例では、回答が複数の観点にわたる詳細な情報を網羅し、クエリのあらゆる要素に包括的に対応しています。

```typescript filename="src/example-high-completeness.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createCompletenessScorer } from '@mastra/evals/scorers/llm';

const scorer = createCompletenessScorer({ model: openai('gpt-4o-mini') });

const query = '光合成のプロセスについて、入力物質、出力物質、および関連する段階を含めて説明してください。';
const response =
  '光合成は、植物が太陽光を化学エネルギーに変換するプロセスです。入力物質:二酸化炭素(CO2)は気孔を通じて空気中から取り込まれ、水(H2O)は根から吸収され、太陽光はクロロフィルによって捕捉されエネルギーを提供します。このプロセスは2つの主要な段階で起こります:1)チラコイドにおける光依存反応では、光エネルギーをATPとNADPHに変換し、同時に水を分解して酸素を放出します。2)ストロマにおける光非依存反応(カルビン回路)では、ATP、NADPH、CO2を使用してグルコースを生成します。出力物質:グルコース(C6H12O6)は植物の栄養源となり、酸素(O2)は副産物として放出されます。全体の化学式は次の通りです:6CO2 + 6H2O + 光エネルギー → C6H12O6 + 6O2。';

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 完全性の高い出力 \{#high-completeness-output\}

この出力は、要求されたすべての要素（入力、出力、段階）を網羅し、さらに追加のコンテキストも提供しているため、高い評価を得ています。

```typescript
{
  score: 1,
  reason: "スコアが1である理由は、回答がクエリのすべての側面を包括的に扱っているためです。光合成とは何かを説明し、すべての入力要素(CO2、H2O、日光)を列挙し、両方の段階(光依存反応と光非依存反応)を詳細に説明し、すべての出力(グルコースと酸素)を明示し、さらに化学式も提供しています。重要な側面で欠けているものはありません。"
}
```

## 部分的な網羅性の例 \{#partial-completeness-example\}

この例では、応答はいくつかの重要な点には触れているものの、肝心な側面が抜けていたり、十分な詳細に欠けています。

```typescript filename="src/example-partial-completeness.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createCompletenessScorer } from '@mastra/evals/scorers/llm';

const scorer = createCompletenessScorer({ model: openai('gpt-4o-mini') });

const query = '従業員と雇用主の両方にとって、リモートワークのメリットとデメリットは何ですか?';
const response =
  'リモートワークは、柔軟なスケジュール、通勤時間がないこと、ワークライフバランスの向上など、従業員にとって多くのメリットがあります。また、雇用主にとってはオフィススペースや光熱費のコスト削減にもなります。しかし、リモートワークは従業員の孤立感やコミュニケーション上の課題を引き起こす可能性があります。';

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 部分的な網羅性のアウトプット \{#partial-completeness-output\}

このアウトプットは、従業員向けの福利厚生やいくつかの欠点には触れているものの、雇用主側の欠点についての網羅的なカバーが不足しているため、評価は中程度にとどまります。

```typescript
{
  score: 0.6,
  reason: "スコアが0.6である理由は、回答が従業員側のメリット(柔軟性、通勤不要、ワークライフバランス)と雇用主側のメリットの1つ(コスト削減)、さらに従業員側のデメリット(孤立感、コミュニケーション上の課題)をカバーしているためです。しかし、監督機能の低下、チームの一体感の維持における課題、生産性管理の難しさなど、雇用主側の潜在的なデメリットについては触れられていません。"
}
```

## 完成度が低い例 \{#low-completeness-example\}

この例では、回答が問い合わせに部分的にしか対応しておらず、いくつかの重要な点を見落としています。

```typescript filename="src/example-low-completeness.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createCompletenessScorer } from '@mastra/evals/scorers/llm';

const scorer = createCompletenessScorer({ model: openai('gpt-4o-mini') });

const query =
  '再生可能エネルギーと非再生可能エネルギー源を、コスト、環境への影響、持続可能性の観点から比較してください。';
const response =
  "太陽光や風力などの再生可能エネルギー源は、コストが下がってきています。化石燃料よりも環境に優しいです。";

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 完成度の低い出力 \{#low-completeness-output\}

この出力は、コストと環境影響に軽く触れているだけで、持続可能性にはまったく言及しておらず、詳細な比較も欠いているため、低評価となります。

```typescript
{
  score: 0.2,
  reason: "スコアが0.2である理由は、回答がコスト(再生可能エネルギーのコスト低下)と環境への影響(再生可能エネルギーが化石燃料より優れている点)について表面的に触れているのみで、詳細な比較がなく、持続可能性の観点が欠如しており、特定の非再生可能エネルギー源についての言及もなく、すべての項目において深い考察が不足しているためです。"
}
```

## Scorer の設定 \{#scorer-configuration\}

オプションのパラメータを指定すると、`CompletenessScorer` がレスポンスをどのように採点するかを調整できます。たとえば、`scale` はスコアラーが返すスコアの最大値を設定します。

```typescript showLineNumbers copy
const scorer = createCompletenessScorer({ model: openai("gpt-4o-mini"), options: {
  scale: 1
});
```

> 設定オプションの全一覧は、[CompletenessScorer](/docs/reference/scorers/completeness)をご覧ください。

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形の結果を返します：

```typescript
{
  runId: string,
  extractStepResult: {
    inputElements: string[],
    outputElements: string[],
    missingElements: string[],
    elementCounts: { input: number, output: number }
  },
  score: number
}
```

### score \{#score\}

0 から 1 の間の完全性スコア:

* **1.0**: クエリのあらゆる側面を、十分な詳細で徹底的に扱っている。
* **0.7–0.9**: 重要な点の大部分を適切な詳細でカバーしており、軽微な抜けがある。
* **0.4–0.6**: いくつかの要点には触れているが、重要な側面が欠けている、または詳細が不足している。
* **0.1–0.3**: クエリに部分的にしか対応できておらず、重大な抜けがある。
* **0.0**: クエリに対応していない、または無関係な情報を提供している。

### runId \{#runid\}

このスコアラーの実行を一意に識別する ID。

### extractStepResult \{#extractstepresult\}

抽出された要素とカバレッジの詳細を含むオブジェクト:

* **inputElements**: 入力内で見つかった主要な要素（例: 名詞、動詞、トピック、用語）。
* **outputElements**: 出力内で見つかった主要な要素。
* **missingElements**: 出力内に見つからなかった入力の要素。
* **elementCounts**: 入力と出力に含まれる要素数。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/completeness" />