---
title: "コンテキスト関連度スコアラー"
description: 提供されたコンテキストがエージェントの応答生成にどれほど関連性があり有用かを評価するために、Context Relevanceスコアラーを使用する例。
---

# コンテキスト関連性スコアラー \{#context-relevance-scorer\}

`createContextRelevanceScorerLLM` を使って、提供したコンテキストがエージェントの応答生成にどれだけ関連し、有用かを評価します。このスコアラーは重み付きの関連度レベルを用い、使用されなかった関連コンテキストや不足している情報に対してペナルティを課します。

## インストール \{#installation\}

```bash
npm install @mastra/evals
```

## 関連性が高い例 \{#high-relevance-example\}

この例は、すべてのコンテキストが直接的に回答を支えており、コンテキストとの関連性が非常に高いことを示しています。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextRelevanceScorerLLM } from '@mastra/evals';

const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      'アインシュタインは1921年に光電効果の発見でノーベル賞を受賞しました。',
      '彼は1905年に特殊相対性理論を発表しました。',
      '1915年に発表された一般相対性理論は、重力に関する理解に革命をもたらしました。',
    ],
    scale: 1,
  },
});

const result = await scorer.run({
  input: {
    inputMessages: [
      {
        id: '1',
        role: 'user',
        content: 'アインシュタインの主な科学的業績は何ですか?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content:
        'アインシュタインの主な業績には、光電効果によるノーベル賞、1905年の特殊相対性理論、1915年の一般相対性理論が含まれます。',
    },
  ],
});

console.log(result);
// Output:
// {
//   score: 1.0,
//   reason: "スコアが1.0なのは、すべてのコンテキストがアインシュタインの業績に高い関連性があり、包括的な回答の生成に効果的に使用されたためです。"
// }
```

## 関連性が混在する例 \{#mixed-relevance-example\}

この例は、一部の文脈が無関係または未使用であるため、関連性が中程度であることを示しています。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextRelevanceScorerLLM } from '@mastra/evals';

const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      '日食は月が太陽を遮ることで発生します。',
      '日食の際、月は地球と太陽の間を移動します。',
      '月は夜に見えます。',
      '星は大気の干渉によってまたたきます。',
      '皆既日食は最大7.5分間続くことがあります。',
    ],
    scale: 1,
  },
});

const result = await scorer.run({
  input: {
    inputMessages: [
      {
        id: '1',
        role: 'user',
        content: '日食の原因は何ですか?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content: '日食は月が地球と太陽の間を移動し、太陽光を遮ることで起こります。',
    },
  ],
});

console.log(result);
// デフォルトのペナルティでの出力:
// {
//   score: 0.64,
//   reason: "スコアは0.64です。コンテキスト1と2は関連性が高く使用されており、コンテキスト5は関連性があるものの未使用(10%ペナルティ)、コンテキスト3と4は無関係です。"
// }

// カスタムペナルティ設定の場合
const customScorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      '日食は月が太陽を遮ることで発生します。',
      '日食の際、月は地球と太陽の間を移動します。',
      '月は夜に見えます。',
      '星は大気の干渉によってまたたきます。',
      '皆既日食は最大7.5分間続くことがあります。',
    ],
    penalties: {
      unusedHighRelevanceContext: 0.05, // 未使用コンテキストに対する低めのペナルティ
      missingContextPerItem: 0.1,
      maxMissingContextPenalty: 0.3,
    },
  },
});

const customResult = await customScorer.run({
  input: { inputMessages: [{ id: '1', role: 'user', content: '日食の原因は何ですか?' }] },
  output: [
    {
      id: '2',
      role: 'assistant',
      content: '日食は月が地球と太陽の間を移動し、太陽光を遮ることで起こります。',
    },
  ],
});

console.log(customResult);
// 緩やかなペナルティでの出力:
// {
//   score: 0.69, // 未使用コンテキストのペナルティが軽減されたため、スコアが高くなっています
//   reason: "スコアは0.69です。コンテキスト1と2は関連性が高く使用されており、コンテキスト5は関連性があるものの未使用(5%ペナルティ)、コンテキスト3と4は無関係です。"
// }
```

## 関連性が低い例 \{#low-relevance-example\}

この例は、内容の大半が無関係な情報であり、文脈との関連性が低いことを示しています。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextRelevanceScorerLLM } from '@mastra/evals';

const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      'グレートバリアリーフはオーストラリアにあります。',
      'サンゴ礁は生存のために温かい海水を必要とします。',
      '多くの魚種がサンゴ礁に生息しています。',
      'オーストラリアには6つの州と2つの特別地域があります。',
      'オーストラリアの首都はキャンベラです。',
    ],
    scale: 1,
  },
});

const result = await scorer.run({
  input: {
    inputMessages: [
      {
        id: '1',
        role: 'user',
        content: 'オーストラリアの首都はどこですか？',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content: 'オーストラリアの首都はキャンベラです。',
    },
  ],
});

console.log(result);
// 出力:
// {
//   score: 0.26,
//   reason: "スコアが0.26であるのは、オーストラリアの首都に関する質問に関連しているのが文脈5のみで、他のサンゴ礁に関する文脈は完全に無関係だからです。"
// }
```

## 動的コンテキスト抽出 \{#dynamic-context-extraction\}

実行時の入力に基づいて、コンテキストを動的に抽出します。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextRelevanceScorerLLM } from '@mastra/evals';

const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    contextExtractor: (input, output) => {
      // 入力からクエリを抽出
      const query = input?.inputMessages?.[0]?.content || '';

      // クエリに基づいてコンテキストを動的に取得
      if (query.toLowerCase().includes('einstein')) {
        return ['アインシュタインはE=mc²を打ち立てた', '彼は1921年にノーベル賞を受賞した', '彼の理論は物理学を一変させた'];
      }

      if (query.toLowerCase().includes('climate')) {
        return ['地球の平均気温は上昇している', 'CO2濃度は気候に影響する', '再生可能エネルギーは排出量を減らす'];
      }

      return ['一般的なナレッジベースの項目'];
    },
    penalties: {
      unusedHighRelevanceContext: 0.15, // 未使用の高関連コンテキストに対する15%のペナルティ
      missingContextPerItem: 0.2, // 欠落しているコンテキスト項目1件につき20%のペナルティ
      maxMissingContextPenalty: 0.4, // 欠落コンテキストの総ペナルティは最大40%に制限
    },
    scale: 1,
  },
});
```

## RAG システムとの統合 \{#rag-system-integration\}

取得したコンテキストを評価するために、RAG パイプラインと連携します。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextRelevanceScorerLLM } from '@mastra/evals';

const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    contextExtractor: (input, output) => {
      // RAG の検索結果から抽出
      const ragResults = input.metadata?.ragResults || [];

      // 取得したドキュメントの本文テキストを返す
      return ragResults.filter(doc => doc.relevanceScore > 0.5).map(doc => doc.content);
    },
    penalties: {
      unusedHighRelevanceContext: 0.12, // 高関連だが未使用の RAG コンテキストに対する中程度のペナルティ
      missingContextPerItem: 0.18, // RAG に必要情報が欠落している場合のより高いペナルティ
      maxMissingContextPenalty: 0.45, // RAG システム向けのやや高めの上限
    },
    scale: 1,
  },
});

// RAG システムの性能を評価
const evaluateRAG = async testCases => {
  const results = [];

  for (const testCase of testCases) {
    const score = await scorer.run(testCase);
    results.push({
      query: testCase.input.inputMessages[0].content,
      relevanceScore: score.score,
      feedback: score.reason,
      unusedContext: score.reason.includes('unused'),
      missingContext: score.reason.includes('missing'),
    });
  }

  return results;
};
```

## スコアラーの構成 \{#scorer-configuration\}

### カスタムペナルティ設定 \{#custom-penalty-configuration\}

未使用のコンテキストや不足しているコンテキストに対するペナルティの適用方法を制御します：

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextRelevanceScorerLLM } from '@mastra/evals';

// より厳格なペナルティ設定
const strictScorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      'Einsteinは光電効果でノーベル賞を受賞した',
      '彼は相対性理論を開発した',
      'Einsteinはドイツで生まれた',
    ],
    penalties: {
      unusedHighRelevanceContext: 0.2, // 未使用の高関連性コンテキストごとに20%のペナルティ
      missingContextPerItem: 0.25, // 欠落したコンテキスト項目ごとに25%のペナルティ
      maxMissingContextPenalty: 0.6, // 欠落したコンテキストに対する最大60%のペナルティ
    },
    scale: 1,
  },
});

// 寛容なペナルティ設定
const lenientScorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      'Einsteinは光電効果でノーベル賞を受賞した',
      '彼は相対性理論を開発した',
      'Einsteinはドイツで生まれた',
    ],
    penalties: {
      unusedHighRelevanceContext: 0.05, // 未使用の高関連性コンテキストごとに5%のペナルティ
      missingContextPerItem: 0.1, // 欠落したコンテキスト項目ごとに10%のペナルティ
      maxMissingContextPenalty: 0.3, // 欠落したコンテキストに対する最大30%のペナルティ
    },
    scale: 1,
  },
});

const testRun = {
  input: {
    inputMessages: [
      {
        id: '1',
        role: 'user',
        content: 'Einsteinは物理学で何を成し遂げましたか?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content: 'Einsteinは光電効果に関する研究でノーベル賞を受賞しました。',
    },
  ],
};

const strictResult = await strictScorer.run(testRun);
const lenientResult = await lenientScorer.run(testRun);

console.log('厳格なペナルティ:', strictResult.score); // 未使用のコンテキストによりスコアが低い
console.log('寛容なペナルティ:', lenientResult.score); // スコアが高く、ペナルティが少ない
```

### カスタムスケール係数 \{#custom-scale-factor\}

```typescript
const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: ['関連情報...', '補足情報...'],
    scale: 100, // スコアを0～1ではなく0～100で返します
  },
});

// 結果はスケーリングされます: スコアは0.85ではなく85になります
```

### 複数のコンテキストソースを統合する \{#combining-multiple-context-sources\}

```typescript
const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    contextExtractor: (input, output) => {
      const query = input?.inputMessages?.[0]?.content || '';

      // 複数のソースを統合する
      const kbContext = knowledgeBase.search(query);
      const docContext = documentStore.retrieve(query);
      const cacheContext = contextCache.get(query);

      return [...kbContext, ...docContext, ...cacheContext];
    },
    scale: 1,
  },
});
```

## 結果の理解 \{#understanding-the-results\}

### スコアの解釈 \{#score-interpretation\}

* **0.9-1.0**: 優秀 - すべての文脈が高い関連性を持ち、活用されている
* **0.7-0.8**: 良好 - ほぼ関連しているが、軽微な抜けがある
* **0.4-0.6**: ばらつきあり - 無関係または未活用の文脈が多い
* **0.2-0.3**: 不十分 - ほとんどが無関係な文脈
* **0.0-0.1**: きわめて不十分 - 関連する文脈が見つからない

### 理由の分析 \{#reason-analysis\}

reason フィールドは次の点に関する洞察を提供します:

* 各コンテキスト要素の関連度レベル（high／medium／low／none）
* 応答で実際に使用されたコンテキスト
* 未使用の高関連度コンテキストに対して適用されるペナルティ（`unusedHighRelevanceContext` で設定可能）
* 応答の質を高め得た不足コンテキスト（`missingContextPerItem` により、`maxMissingContextPenalty` を上限としてペナルティ）

### 最適化戦略 \{#optimization-strategies\}

結果を活用してシステムを改善しましょう:

* **無関係なコンテキストをフィルタリング**: 処理前に関連性が低い／ない要素を除去する
* **コンテキストの活用を徹底する**: 関連性の高いコンテキストが取り込まれていることを確実にする
* **コンテキストの欠落を補う**: スコアラーが特定した不足情報を追加する
* **コンテキスト量のバランスを取る**: 最も高い関連性を得られる最適なコンテキスト量を見つける
* **ペナルティ感度を調整する**: 未使用または不足コンテキストの許容度に応じて `unusedHighRelevanceContext`、`missingContextPerItem`、`maxMissingContextPenalty` を調整する

## Context Precision との比較 \{#comparison-with-context-precision\}

ニーズに合ったスコアラーを選びましょう:

| ユースケース             | Context Relevance    | Context Precision         |
| ------------------------ | -------------------- | ------------------------- |
| **RAG 評価**             | 使用状況が重要な場合 | ランキングが重要な場合   |
| **コンテキスト品質**     | きめ細かな段階        | 二値の関連性             |
| **欠落検出**             | ✓ 抜け漏れを特定      | ✗ 評価対象外             |
| **利用状況のトラッキング** | ✓ 利用状況を追跡      | ✗ 考慮しない             |
| **位置感度**             | ✗ 位置に依存しない    | ✓ 先頭配置を高く評価      |

## 関連する例 \{#related-examples\}

* [Context Precision の例](/docs/examples/scorers/context-precision) - コンテキストの順位付けを評価する
* [Faithfulness の例](/docs/examples/scorers/faithfulness) - コンテキストに対する根拠の忠実性を測定する
* [Answer Relevancy の例](/docs/examples/scorers/answer-relevancy) - 回答の関連性を評価する