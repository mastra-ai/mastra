---
title: "回答の類似度"
description: CI/CD テストにおいて、Answer Similarity スコアラーを使ってエージェントの出力を正解と照合・比較する例。
---

# 回答類似度スコアラー \{#answer-similarity-scorer\}

`createAnswerSimilarityScorer` を使用して、エージェントの出力を正解と照合・比較します。このスコアラーは、期待する回答が定義されており、時間の経過に伴う一貫性を担保したい CI/CD テストシナリオ向けに設計されています。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の詳細なドキュメントと設定オプションについては、[`createAnswerSimilarityScorer`](/docs/reference/scorers/answer-similarity)を参照してください。

## 完全に一致する例 \{#perfect-similarity-example\}

この例では、エージェントの出力は意味の上でグラウンドトゥルースと完全に一致しています。

```typescript filename="src/example-perfect-similarity.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { runExperiment } from '@mastra/core/scores';
import { createAnswerSimilarityScorer } from '@mastra/evals/scorers/llm';
import { myAgent } from './agent';

const scorer = createAnswerSimilarityScorer({ model: openai('gpt-4o-mini') });

const result = await runExperiment({
  data: [
    {
      input: '2+2はいくつですか?',
      groundTruth: '4',
    },
  ],
  scorers: [scorer],
  target: myAgent,
});

console.log(result.scores);
```

### 完全一致の出力 \{#perfect-similarity-output\}

エージェントの回答と正解が一致しているため、出力は満点となります。

```typescript
{
  "Answer Similarity Scorer": {
    score: 1.0,
    reason: "スコアは1.0/1です。出力が正解と完全に一致しているためです。エージェントは数値回答を正確に提供しました。完全に正確な応答のため、改善の必要はありません。"
  }
}
```

## 高い意味的類似性の例 \{#high-semantic-similarity-example\}

この例では、エージェントは表現こそ異なるものの、グラウンドトゥルースと同じ情報を提供します。

```typescript filename="src/example-semantic-similarity.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { runExperiment } from '@mastra/core/scores';
import { createAnswerSimilarityScorer } from '@mastra/evals/scorers/llm';
import { myAgent } from './agent';

const scorer = createAnswerSimilarityScorer({ model: openai('gpt-4o-mini') });

const result = await runExperiment({
  data: [
    {
      input: 'フランスの首都はどこですか?',
      groundTruth: 'フランスの首都はパリです',
    },
  ],
  scorers: [scorer],
  target: myAgent,
});

console.log(result.scores);
```

### 高い意味的類似性のある出力 \{#high-semantic-similarity-output\}

同等の意味で同じ情報を伝えているため、この出力は高いスコアを獲得します。

```typescript
{
  "Answer Similarity Scorer": {
    score: 0.9,
    reason: "スコアは0.9/1です。両方の回答がパリはフランスの首都であるという同じ情報を伝えているためです。エージェントは主要な事実を、表現は若干異なるものの正確に特定しました。構造に多少の違いはありますが、意味的には同等です。"
  }
}
```

## 部分的な類似性の例 \{#partial-similarity-example\}

この例では、エージェントの応答は一部正しいものの、重要な情報が欠けています。

```typescript filename="src/example-partial-similarity.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { runExperiment } from '@mastra/core/scores';
import { createAnswerSimilarityScorer } from '@mastra/evals/scorers/llm';
import { myAgent } from './agent';

const scorer = createAnswerSimilarityScorer({ model: openai('gpt-4o-mini') });

const result = await runExperiment({
  data: [
    {
      input: '原色は何ですか?',
      groundTruth: '原色は赤、青、黄色です',
    },
  ],
  scorers: [scorer],
  target: myAgent,
});

console.log(result.scores);
```

### 部分的な類似の出力 \{#partial-similarity-output\}

一部に正しい情報が含まれているものの不完全であるため、出力は中程度のスコアとなります。

```typescript
{
  "Answer Similarity Scorer": {
    score: 0.6,
    reason: "スコアは0.6/1です。回答はいくつかの重要な要素を捉えていますが不完全です。エージェントは赤と青を原色として正しく識別しました。しかし、完全な回答に不可欠な黄色が欠けています。"
  }
}
```

## 矛盾の例 \{#contradiction-example\}

この例では、エージェントが事実に反する情報を示し、真の値と矛盾しています。

```typescript filename="src/example-contradiction.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { runExperiment } from '@mastra/core/scores';
import { createAnswerSimilarityScorer } from '@mastra/evals/scorers/llm';
import { myAgent } from './agent';

const scorer = createAnswerSimilarityScorer({ model: openai('gpt-4o-mini') });

const result = await runExperiment({
  data: [
    {
      input: '『ロミオとジュリエット』を書いたのは誰ですか?',
      groundTruth: 'ウィリアム・シェイクスピアが『ロミオとジュリエット』を書きました',
    },
  ],
  scorers: [scorer],
  target: myAgent,
});

console.log(result.scores);
```

### 矛盾のある出力 \{#contradiction-output\}

事実誤認が含まれているため、この出力のスコアは非常に低くなります。

```typescript
{
  "Answer Similarity Scorer": {
    score: 0.0,
    reason: "スコアが0.0/1である理由は、出力に著者に関する重大な誤りが含まれているためです。エージェントは戯曲のタイトルは正しく特定しましたが、作者をWilliam ShakespeareではなくChristopher Marloweとしており、これは根本的な誤りです。"
  }
}
```

## CI/CD 統合例 \{#cicd-integration-example\}

テストスイートで scorer を使用して、時間の経過に伴うエージェントの一貫性を維持します。

```typescript filename="src/ci-integration.test.ts" showLineNumbers copy
import { describe, it, expect } from 'vitest';
import { openai } from '@ai-sdk/openai';
import { runExperiment } from '@mastra/core/scores';
import { createAnswerSimilarityScorer } from '@mastra/evals/scorers/llm';
import { myAgent } from './agent';

describe('エージェント一貫性テスト', () => {
  const scorer = createAnswerSimilarityScorer({ model: openai('gpt-4o-mini') });

  it('正確な事実に基づく回答を提供すること', async () => {
    const result = await runExperiment({
      data: [
        {
          input: '光の速度は何ですか?',
          groundTruth: '真空中の光の速度は毎秒299,792,458メートルです',
        },
        {
          input: '日本の首都は何ですか?',
          groundTruth: '東京は日本の首都です',
        },
      ],
      scorers: [scorer],
      target: myAgent,
    });

    // すべての回答が類似度の閾値を満たすことを確認
    expect(result.scores['Answer Similarity Scorer'].score).toBeGreaterThan(0.8);
  });

  it('複数回の実行で一貫性を維持すること', async () => {
    const testData = {
      input: '機械学習を定義してください',
      groundTruth: '機械学習は、システムが経験から学習し改善することを可能にするAIのサブセットです',
    };

    // 一貫性を確認するために複数回実行
    const results = await Promise.all([
      runExperiment({ data: [testData], scorers: [scorer], target: myAgent }),
      runExperiment({ data: [testData], scorers: [scorer], target: myAgent }),
      runExperiment({ data: [testData], scorers: [scorer], target: myAgent }),
    ]);

    // すべての実行が類似したスコアを生成することを確認(0.1の許容範囲内)
    const scores = results.map(r => r.scores['Answer Similarity Scorer'].score);
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    expect(maxDiff).toBeLessThan(0.1);
  });
});
```

## カスタム構成の例 \{#custom-configuration-example\}

特定のユースケースに応じてスコアラーの動作をカスタマイズします。

```typescript filename="src/custom-config.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { runExperiment } from '@mastra/core/scores';
import { createAnswerSimilarityScorer } from '@mastra/evals/scorers/llm';
import { myAgent } from './agent';

// 厳密な完全一致を高スケールで設定
const strictScorer = createAnswerSimilarityScorer({
  model: openai('gpt-4o-mini'),
  options: {
    exactMatchBonus: 0.5, // 完全一致時のボーナスを高く設定
    contradictionPenalty: 2.0, // 矛盾に対して非常に厳格に評価
    missingPenalty: 0.3, // 情報不足に対するペナルティを高く設定
    scale: 10, // 1点満点ではなく10点満点で評価
  },
});

// 寛容な意味的マッチングを設定
const lenientScorer = createAnswerSimilarityScorer({
  model: openai('gpt-4o-mini'),
  options: {
    semanticThreshold: 0.6, // 意味的マッチングの閾値を低く設定
    contradictionPenalty: 0.5, // 軽微な矛盾に対して寛容に評価
    extraInfoPenalty: 0, // 追加情報に対するペナルティなし
    requireGroundTruth: false, // 正解データの欠落を許可
  },
});

const result = await runExperiment({
  data: [
    {
      input: '光合成を説明してください',
      groundTruth: '光合成は植物が光エネルギーを化学エネルギーに変換するプロセスです',
    },
  ],
  scorers: [strictScorer, lenientScorer],
  target: myAgent,
});

console.log('厳格なスコアラー:', result.scores['Answer Similarity Scorer'].score); // 10点満点
console.log('寛容なスコアラー:', result.scores['Answer Similarity Scorer'].score); // 1点満点
```

## 主なメリット \{#key-benefits\}

* **回帰テスト**: エージェントの挙動の思わぬ変化を検知
* **品質保証**: 応答が期待水準を満たしているかを確認
* **セマンティック理解**: 単なる文字列一致を超えて意味を把握
* **実用的なフィードバック**: 改善点を明確に解説
* **CI/CD 対応**: 自動テストパイプライン向けに設計

<GithubLink href="https://github.com/mastra-ai/mastra/tree/main/packages/evals/src/scorers/llm/answer-similarity" />