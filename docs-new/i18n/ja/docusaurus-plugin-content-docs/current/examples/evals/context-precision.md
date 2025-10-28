---
title: "コンテキスト精度"
description: コンテキスト情報の活用精度を評価するために Context Precision 指標を用いる例。
---

# コンテキスト精度の評価 \{#context-precision-evaluation\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のためのメタデータの充実、データ構造を評価する柔軟性の向上を備えた新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ContextPrecisionMetric` を使用して、レスポンスが与えられたコンテキストの中で最も関連性の高い部分に適切に基づいているかどうかを評価します。このメトリックは `query` と `response` を受け取り、スコアと理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 高精度の例 \{#high-precision-example\}

この例では、応答はクエリに直接関係するコンテキストのみに基づいています。すべてのコンテキストが回答を支えており、その結果、高い精度スコアとなります。

```typescript filename="src/example-high-precision.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextPrecisionMetric } from '@mastra/evals/llm';

const metric = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
  context: [
    '光合成は太陽光をエネルギーに変換する。',
    '植物は光合成に葉緑素を使う。',
    '光合成は副産物として酸素を生成する。',
    'このプロセスには太陽光と葉緑素が必要である。',
  ],
});

const query = '光合成とは何か、どのように機能するのか?';
const response =
  '光合成は、植物が葉緑素を使って太陽光をエネルギーに変換し、副産物として酸素を生成するプロセスである。';

const result = await metric.measure(query, response);

console.log(result);
```

### 高精度な出力 \{#high-precision-output\}

この出力は、無関係な情報を一切含まず、すべてのコンテキスト文がクエリへの回答に直接寄与しているため、満点と評価されます。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1である理由は、すべてのコンテキストノードが関連性を持ち、光合成の直接的な定義、説明、および重要な構成要素を提供しているためです。最初のノードでプロセスが定義され、その後クロロフィルと酸素生成に関する補足的な詳細が続き、すべてが最適なランキング順序で配置されています。'
  }
}
```

## 混合精度の例 \{#mixed-precision-example\}

この例では、回答が1つ以上の関連するコンテキスト項目を利用している一方で、無関係な情報や注意をそらす情報も含まれています。その結果、全体の精度スコアが下がります。

```typescript filename="src/example-mixed-precision.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextPrecisionMetric } from '@mastra/evals/llm';

const metric = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
  context: [
    "火山は地球の地殻にある開口部です。",
    '火山は活火山、休火山、死火山に分類されます。',
    'ハワイには多くの活火山があります。',
    '環太平洋火山帯には多くの火山があります。',
  ],
});

const query = '火山にはどのような種類がありますか?';
const response = '火山は活動状況に基づいて、活火山、休火山、死火山に分類できます。';

const result = await metric.measure(query, response);

console.log(result);
```

### 混合精度の出力 \{#mixed-precision-output\}

この出力は、関連する文脈を用いてはいるものの、無関係または不要な情報に紛れて全体の精度を損ねているため、評価は中程度となります。

```typescript
{
  score: 0.58,
  info: {
    reason: 'スコアが0.58となった理由は、2番目と3番目のノードが火山の種類に関する明確な定義と例を提供していた一方で、1番目と4番目のノードは関連性がなく、精度スコアの低下を招いたためです。また、関連するノードが最適な順序で配置されておらず、最も有用な情報が先頭に来ていなかったことも、全体的な有効性に影響しました。'
  }
}
```

## 精度が低い例 \{#low-precision-example\}

この例では、応答は提供されたコンテキストのごく一部しか活用していません。コンテキストの大半がクエリと無関係なため、精度スコアが低くなります。

```typescript filename="src/example-low-precision.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextPrecisionMetric } from '@mastra/evals/llm';

const metric = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
  context: [
    'ナイル川はアフリカにあります。',
    'ナイル川は世界で最も長い川です。',
    '古代エジプト人はナイル川を利用していました。',
    'ナイル川は北に流れます。',
  ],
});

const query = 'ナイル川はどの方向に流れますか?';
const response = 'ナイル川は北に向かって流れます。';

const result = await metric.measure(query, response);

console.log(result);
```

### 低精度の出力 \{#low-precision-output\}

この出力は、クエリに関連するコンテキストが1件しかないため、スコアが低くなっています。残りのコンテキストは無関係で、応答に寄与しません。

```typescript
{
  score: 0.25,
  info: {
    reason: "スコアが0.25なのは、4番目のコンテキストノードのみがナイル川の流れる方向についての質問に直接回答しているのに対し、最初の3つのノードは無関係で有用な情報を提供していないためです。これは、取得されたコンテキストの大半が期待される出力に貢献しなかったことを示しており、全体的な関連性に重大な制約があることを浮き彫りにしています。"
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

関連する背景情報を表す `context` 配列を指定して、`ContextPrecisionMetric` インスタンスを作成できます。さらに、最大スコアを設定するための `scale` などの任意パラメータも構成できます。

```typescript showLineNumbers copy
const metric = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
  context: [''],
  scale: 1,
});
```

> 構成オプションの一覧については、[ContextPrecisionMetric](/docs/reference/evals/context-precision) をご覧ください。

## 結果の理解 \{#understanding-the-results\}

`ContextPrecisionMetric` は次の形の結果を返します：

```typescript
{
  score: number,
  info: {
    reason: string
  }
}
```

### 適合率スコア \{#precision-score\}

0〜1 の範囲の適合率スコア:

* **1.0**: 完全な適合 — すべてのコンテキスト項目が関連し、使用されている。
* **0.7–0.9**: 高適合 — ほとんどのコンテキスト項目が関連している。
* **0.4–0.6**: ばらつきのある適合 — 一部のコンテキスト項目のみ関連している。
* **0.1–0.3**: 低適合 — わずかなコンテキスト項目のみ関連している。
* **0.0**: 非適合 — 関連するコンテキスト項目がない。

### 精度に関する情報 \{#precision-info\}

スコアの説明。詳細には次が含まれます:

* 各コンテキスト項目がクエリやレスポンスにどの程度関連しているか
* 関連する項目がレスポンスに含まれていたかどうか
* 無関係なコンテキストが誤って含まれていなかったかどうか
* 提供されたコンテキストに対するレスポンスの全体的な有用性と焦点の適切さ

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/context-precision" />