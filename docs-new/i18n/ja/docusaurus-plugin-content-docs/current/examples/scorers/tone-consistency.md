---
title: "トーンの一貫性"
description: テキストの感情トーンのパターンと感情の一貫性を評価するために、Tone Consistency スコアラーを使用する例。
---

# トーン一貫性スコアラー \{#tone-consistency-scorer\}

`createToneConsistencyScorer` を使用して、テキスト内の感情的トーンのパターンと感情表現の一貫性を評価します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の完全なドキュメントおよび設定オプションについては、[`createToneScorer`](/docs/reference/scorers/tone-consistency)を参照してください。

## ポジティブなトーンの例 \{#positive-tone-example\}

この例では、いずれのテキストも似たポジティブなトーンを示しています。スコアラーはトーンの整合性を評価し、その結果として高いスコアを付与します。

```typescript filename="src/example-positive-tone.ts" showLineNumbers copy
import { createToneScorer } from '@mastra/evals/scorers/code';

const scorer = createToneScorer();

const input = 'この製品は素晴らしく、最高です!';
const output = 'この製品は優れていて、素晴らしいです!';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### ポジティブなトーンの出力 \{#positive-tone-output\}

スコアラーは、強い感情一致を示す高いスコアを返します。`analyzeStepResult` フィールドには、感情の値とその差分が含まれます。

```typescript
{
  score: 0.8333333333333335,
  analyzeStepResult: {
    responseSentiment: 1.3333333333333333,
    referenceSentiment: 1.1666666666666667,
    difference: 0.16666666666666652,
  },
}
```

## 安定したトーンの例 \{#stable-tone-example\}

この例では、空のレスポンスを渡すことで、テキスト内のトーンの一貫性を分析します。これによりスコアラーは、単一の入力テキストにおける感情の安定性を評価し、テキスト全体でトーンがどれほど均一かを示すスコアを算出します。

```typescript filename="src/example-stable-tone.ts" showLineNumbers copy
import { createToneScorer } from '@mastra/evals/scorers/code';

const scorer = createToneScorer();

const input = '素晴らしいサービス！フレンドリーなスタッフ。完璧な雰囲気。';
const output = '';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップの結果:', result.analyzeStepResult);
```

### 安定したトーン出力 \{#stable-tone-output\}

スコアラーは、入力テキスト全体で感情傾向が一貫していることを示す高スコアを返します。`analyzeStepResult` フィールドには平均感情値と感情の分散が含まれ、トーンの安定性を示します。

```typescript
{
  score: 0.9444444444444444,
  analyzeStepResult: {
    avgSentiment: 1.3333333333333333,
    sentimentVariance: 0.05555555555555556,
  },
}
```

## トーンが混在する例 \{#mixed-tone-example\}

この例では、入力と応答の感情的なトーンが異なります。スコアラーはこうした違いを捉え、一貫性スコアを低く評価します。

```typescript filename="src/example-mixed-tone.ts" showLineNumbers copy
import { createToneScorer } from '@mastra/evals/scorers/code';

const scorer = createToneScorer();

const input = 'インターフェースは使いづらく分かりにくいですが、可能性はあります。';
const output = 'デザインには将来性がありますが、使いやすくするには大幅な改善が必要です。';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### トーンが混在した出力 \{#mixed-tone-output\}

感情的トーンに顕著な違いがあるため、スコアラーは低いスコアを返します。`analyzeStepResult` フィールドは、センチメント値とそれらのばらつきの度合いを示します。

```typescript
{
  score: 0.4181818181818182,
  analyzeStepResult: {
    responseSentiment: -0.4,
    referenceSentiment: 0.18181818181818182,
    difference: 0.5818181818181818,
  },
}
```

## スコアラーの設定 \{#scorer-configuration\}

`ToneConsistencyScorer` インスタンスはデフォルト設定のままで作成できます。追加の設定は不要です。

```typescript
const scorer = createToneScorer();
```

> 設定オプションの全一覧については、[ToneConsistencyScorer](/docs/reference/scorers/tone-consistency) をご覧ください。

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形式の結果を返します:

```typescript
{
  runId: string,
  analyzeStepResult: {
    responseSentiment?: number,
    referenceSentiment?: number,
    difference?: number,
    avgSentiment?: number,
    sentimentVariance?: number,
  },
  score: number
}
```

### score \{#score\}

0〜1の範囲のトーン一貫性スコア:

* **0.8〜1.0**: 非常に一貫したトーン。
* **0.6〜0.7**: おおむね一貫したトーン。
* **0.4〜0.5**: トーンが混在。
* **0.0〜0.3**: トーンが矛盾。

### runId \{#runid\}

このスコアラーの実行に対する一意の識別子です。

### analyzeStepResult \{#analyzestepresult\}

トーン指標を含むオブジェクト：

* **responseSentiment**: 応答の感情スコア（比較モード）。
* **referenceSentiment**: 入力／参照の感情スコア（比較モード）。
* **difference**: 感情スコア間の絶対差（比較モード）。
* **avgSentiment**: 文単位の平均感情（安定性モード）。
* **sentimentVariance**: 文単位の感情の分散（安定性モード）。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/tone-consistency" />