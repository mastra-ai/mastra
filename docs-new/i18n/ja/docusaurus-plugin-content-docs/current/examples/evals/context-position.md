---
title: "コンテキスト位置"
description: 応答の順序付けを評価するために Context Position 指標を用いる例。
---

# コンテキスト位置評価 \{#context-position-evaluation\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のためのより豊富なメタデータ、そしてデータ構造を評価する柔軟性を備えた、Scorers という新しい evals API をリリースしました。移行は比較的簡単ですが、既存の Evals API も引き続きサポートします。

:::

`ContextPositionMetric` を使うと、レスポンスが最も関連性の高いコンテキストセグメントに裏付けられているかを評価できます。このメトリックは `query` と `response` を受け取り、スコアと理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 高い位置付けの例 \{#high-position-example\}

この例では、提供されたコンテキストの最初の文を用いて、応答がクエリに直接答えています。周辺のコンテキストも一貫した補強情報で応答を裏付けており、結果として強い位置付けの整合性が得られます。

```typescript filename="src/example-high-position.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextPositionMetric } from '@mastra/evals/llm';

const metric = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: [
    'フランスの首都はパリです。',
    'パリは508年から首都となっています。',
    'パリはフランスの政治の中心地です。',
    '首都にはフランス政府が置かれています。',
  ],
});

const query = 'フランスの首都は何ですか?';
const response = 'フランスの首都はパリです。';

const result = await metric.measure(query, response);

console.log(result);
```

### 高位置の出力 \{#high-position-output\}

この出力は、関連情報がコンテキストの冒頭にあり、雑音や余計な要素に妨げられることなく回答を直接支えているため、満点となります。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1である理由は、提供されたすべてのコンテキストが、パリがフランスの首都であることを裏付けることで出力を直接サポートしており、各記述が歴史的、政治的、機能的な関連性を通じて回答を補強しているためです。'
  }
}
```

## 混在した位置の例 \{#mixed-position-example\}

この例では、回答が非常に関連性の高い情報に、文脈の後半から引いた追加の詳細を組み合わせています。重量に関する事実は問いに答えていますが、関連性の低い事実を含めたことで、回答の位置的な精度が下がっています。

```typescript filename="src/example-mixed-position.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextPositionMetric } from '@mastra/evals/llm';

const metric = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: [
    '象は草食動物です。',
    '成体の象の体重は最大13,000ポンドになります。',
    '象は陸上最大の動物です。',
    '象は植物や草を食べます。',
  ],
});

const query = '象の体重はどのくらいですか?';
const response = '成体の象の体重は最大13,000ポンドになり、陸上最大の動物です。';

const result = await metric.measure(query, response);

console.log(result);
```

### 中間的な位置づけの出力 \{#mixed-position-output\}

関連情報は含まれているものの、優先度の低い文脈と混ざっているため、評価は中程度にとどまります。これにより、文脈の並び順と応答の焦点との整合が弱まります。

```typescript
{
  score: 0.4,
  info: {
    reason: 'スコアが0.4なのは、成体のゾウの体重に関する直接的な回答が含まれており、関連性が非常に高いためです。ただし、ゾウが草食動物であることや食習慣といった、体重の理解に寄与しない無関係な情報も含まれています。関連性のある情報と無関係な情報の両方が含まれているため、全体的なスコアが低くなっています。'
  }
}
```

## 低位置の例 \{#low-position-example\}

この例では、応答がコンテキストの末尾にある関連情報を参照しています。コンテキストの前半には無関係な説明的な詳細が含まれており、裏付け情報の想定される順序が乱されています。

```typescript filename="src/example-low-position.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextPositionMetric } from '@mastra/evals/llm';

const metric = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: [
    '虹は空に現れます。',
    '虹にはさまざまな色があります。',
    '虹は曲線の形をしています。',
    '虹は太陽光が水滴に当たることで形成されます。',
  ],
});

const query = '虹はどのように形成されますか?';
const response = '虹は、太陽光が空気中の水滴と相互作用することで生成されます。';

const result = await metric.measure(query, response);

console.log(result);
```

### 低位置の出力 \{#low-position-output\}

主要な根拠情報が文脈の後半で提示され、前半の内容がクエリにほとんど寄与しないため、出力のスコアは低くなります。

```typescript
{
  score: 0.12,
  info: {
    reason: 'スコアが0.12なのは、関連するコンテキストが虹の形成方法を直接説明しているのに対し、他の記述は形成プロセスとは無関係、または間接的にしか関連していない情報を提供しているためです。'
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

期待される情報の並びを表す `context` 配列を指定して、`ContextPositionMetric` インスタンスを作成できます。`scale` などのオプションパラメータを設定して、取り得る最大スコアを指定することもできます。

```typescript showLineNumbers copy
const metric = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: [''],
  scale: 1,
});
```

> 設定オプションの全一覧は、[ContextPositionMetric](/docs/reference/evals/context-position) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`ContextPositionMetric` は次の形の結果を返します：

```typescript
{
  score: number,
  info: {
    reason: string
  }
}
```

### 位置スコア \{#position-score\}

位置スコアは0から1の範囲です：

* **1.0**: 完璧な配置 – 最も重要な情報が最初にある。
* **0.7–0.9**: 良好な配置 – 重要な情報の多くが冒頭にある。
* **0.4–0.6**: ばらつきのある配置 – 重要な情報が全体に散らばっている。
* **0.1–0.3**: 弱い配置 – 重要な情報の多くが末尾にある。
* **0.0**: 配置不適切 – まったく無関係、または順序が逆になっている。

### 位置情報 \{#position-info\}

スコアの説明。詳細は次のとおりです：

* クエリと応答に対するコンテキストの関連性
* コンテキストのシーケンス内での関連コンテンツの位置
* 後半よりも前半のコンテキストを重視すること
* コンテキスト全体の構成と整理

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/context-position" />