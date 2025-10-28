---
title: "Context Precision Scorer（コンテキスト適合度スコアラー）"
description: Mean Average Precision を用いて、RAG システムで取得されたコンテキストの関連性と並び順を評価するための Context Precision Scorer の使用例。
---

# コンテキスト精度スコアラー \{#context-precision-scorer\}

`createContextPrecisionScorer` を使用して、取得したコンテキストが期待される出力の生成をどれだけ適切に支援しているかを評価します。このスコアラーは Mean Average Precision（MAP）を用いて、関連性の高いコンテキストをシーケンスの先頭付近に配置するシステムを高く評価します。

## インストール \{#installation\}

```bash
npm install @mastra/evals
```

## 高精度の例 \{#high-precision-example\}

この例は、必要なコンテキストが冒頭にすべて揃っており、コンテキスト精度が完璧であることを示しています。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextPrecisionScorer } from '@mastra/evals';

const scorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      '光合成は、植物が太陽光、二酸化炭素、水をグルコースと酸素に変換するプロセスです。',
      'このプロセスは植物細胞の葉緑体、特にチラコイドで起こります。',
      '光依存反応はチラコイド膜で起こり、カルビン回路はストロマで起こります。',
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
        content: '植物の光合成はどのように機能しますか?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content:
        '光合成は、植物が葉緑体を使って太陽光、CO2、水をグルコースと酸素に変換するプロセスです。',
    },
  ],
});

console.log(result);
// Output:
// {
//   score: 1.0,
//   reason: "スコアは1.0です。すべてのコンテキスト要素が光合成の説明に高い関連性を持ち、期待される出力をサポートするために最適な順序で配置されているためです。"
// }
```

## 混合精度の例 \{#mixed-precision-example\}

この例は、関連する文脈と無関係な文脈の両方を含む、ほどほどの精度を示しています。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextPrecisionScorer } from '@mastra/evals';

const scorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      '定期的な運動は心筋を強化することで心血管の健康を改善します。',
      'バランスの取れた食事には果物、野菜、全粒穀物を含めるべきです。',
      '身体活動はエンドルフィンを放出し、気分を改善しストレスを軽減します。',
      '平均的な人は1日に8杯の水を飲むべきです。',
      '運動はまた、健康的な体重と筋肉量を維持するのに役立ちます。',
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
        content: '運動の精神的および身体的なメリットは何ですか?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content:
        '運動は心血管系に良い効果をもたらし、エンドルフィンの放出により気分を改善し、健康的な体組成の維持に役立ちます。',
    },
  ],
});

console.log(result);
// Output:
// {
//   score: 0.72,
//   reason: "スコアが0.72なのは、コンテキスト1、3、5が運動のメリットに関連している一方で、食事と水分補給に関する無関係なコンテキストが精度スコアを低下させているためです。"
// }
```

## 低精度の例 \{#low-precision-example\}

この例は、文脈の大半が無関係で、コンテキスト精度が低いことを示しています。

```typescript
import { openai } from '@ai-sdk/openai';
import { createContextPrecisionScorer } from '@mastra/evals';

const scorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      '今週末は晴天の予報です。',
      'コーヒーは世界で最も人気のある飲料の一つです。',
      '機械学習には大量のトレーニングデータが必要です。',
      '猫は通常1日12〜16時間眠ります。',
      'フランスの首都はパリです。',
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
        content: '光合成はどのように機能しますか?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content: '光合成は、植物が葉緑素を使って太陽光をエネルギーに変換するプロセスです。',
    },
  ],
});

console.log(result);
// 出力:
// {
//   score: 0.0,
//   reason: "スコアが0.0なのは、取得されたコンテキストのいずれも光合成の説明に関連していないためです。"
// }
```

## スコアラーの設定 \{#scorer-configuration\}

### カスタムスケール係数 \{#custom-scale-factor\}

```typescript
const scorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      '機械学習モデルには訓練データが必要です。',
      'ディープラーニングは複数の層を持つニューラルネットワークを使用します。',
    ],
    scale: 10, // スコアを0-1ではなく0-10でスケーリング
  },
});

// 結果はスケーリングされます: score: 8.5(0.85ではなく)
```

### 動的なコンテキスト抽出 \{#dynamic-context-extraction\}

```typescript
const scorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
  options: {
    contextExtractor: (input, output) => {
      // クエリに基づいてコンテキストを動的に抽出する
      const query = input?.inputMessages?.[0]?.content || '';

      // 例：ベクトルデータベースから取得
      const searchResults = vectorDB.search(query, { limit: 10 });
      return searchResults.map(result => result.content);
    },
    scale: 1,
  },
});
```

### 大規模コンテキスト評価 \{#large-context-evaluation\}

```typescript
const scorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      // ベクトルデータベースから取得したドキュメントをシミュレート
      'Document 1: 関連性の高いコンテンツ...',
      'Document 2: やや関連するコンテンツ...',
      'Document 3: 間接的に関連...',
      'Document 4: 関連性なし...',
      'Document 5: 関連性の高いコンテンツ...',
      // ... 数十個のコンテキストまで
    ],
  },
});
```

## 結果の理解 \{#understanding-the-results\}

### スコアの解釈 \{#score-interpretation\}

* **0.9–1.0**: 精度が非常に高い - シーケンスの早い段階に関連する文脈がすべて含まれている
* **0.7–0.8**: 精度が良好 - ほとんどの関連する文脈が適切に配置されている
* **0.4–0.6**: 精度は中程度 - 関連する文脈が無関係なものと混在している
* **0.1–0.3**: 精度が低い - 関連する文脈が少ない、または配置が不適切
* **0.0**: 関連する文脈が見つからない

### 理由の分析 \{#reason-analysis\}

理由フィールドでは次の点を説明します：

* どのコンテキスト要素が関連あり／なしと判断されたか
* 位置づけが MAP の算出にどのように影響したか
* 評価で用いられた具体的な関連性の基準

### 最適化のポイント \{#optimization-insights\}

結果の活用先:

* **検索の改善**: ランキング前に不適切なコンテキストを除外する
* **ランキングの最適化**: 関連性の高いコンテキストが先頭に来るようにする
* **チャンクサイズの調整**: コンテキストの詳細度と関連性の精度のバランスを取る
* **埋め込みの評価**: 取得精度を高めるために異なる埋め込みモデルを試す

## 関連例 \{#related-examples\}

* [Answer Relevancy の例](/docs/examples/scorers/answer-relevancy) - 回答の妥当性を評価する
* [Faithfulness の例](/docs/examples/scorers/faithfulness) - 文脈への忠実性を測定する
* [Hallucination の例](/docs/examples/scorers/hallucination) - でっち上げられた情報を検出する