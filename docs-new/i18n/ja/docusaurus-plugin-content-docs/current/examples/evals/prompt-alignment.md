---
title: "プロンプト整合性"
description: 応答の指示遵守を評価するために Prompt Alignment 指標を用いる例。
---

# プロンプト整合性評価 \{#prompt-alignment-evaluation\}

:::info 新しい Scorers API

エラー分析のためのメタデータをより多く保存し、データ構造の評価にも柔軟に対応できる、より扱いやすい API「Scorers」という新しい evals API を公開しました。移行は比較的簡単ですが、既存の Evals API も引き続きサポートします。

:::

`PromptAlignmentMetric` を使用して、応答が与えられた一連の指示にどの程度従っているかを評価します。メトリクスは `query` と `response` を受け取り、スコアと、理由および指示レベルでの整合性の詳細を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 完全準拠の例 \{#perfect-alignment-example\}

この例では、応答が入力の適用可能な指示すべてに従っています。スコアは完全な準拠を反映しており、見落としや無視された指示はありません。

```typescript filename="src/example-high-perfect-alignment.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { PromptAlignmentMetric } from '@mastra/evals/llm';

const metric = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
  instructions: [
    '完全な文で記述すること',
    '気温は摂氏で表記すること',
    '風の状況を記載すること',
    '降水確率を明記すること',
  ],
});

const query = '天気はどうですか?';
const response =
  '気温は摂氏22度で、北西から適度な風が吹いています。降水確率は30%です。';

const result = await metric.measure(query, response);

console.log(result);
```

### 完全整合の出力 \{#perfect-alignment-output\}

この応答は、該当するすべての指示を完全に満たしているため、高いスコアを獲得します。`info` フィールドは、各指示が漏れなく遵守されたことを示しています。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1なのは、出力が該当するすべての指示に完全に従い、気温、風況、降水確率を含む包括的な天気予報を、すべて完結した文で提示しているためです。',
    scoreDetails: {
      totalInstructions: 4,
      applicableInstructions: 4,
      followedInstructions: 4,
      naInstructions: 0
    }
  }
}
```

## 混在アラインメントの例 \{#mixed-alignment-example\}

この例では、応答はいくつかの指示には従う一方で、別の指示は守っていません。スコアは部分的な順守を反映しており、守られた指示と見落とされた指示が混在しています。

```typescript filename="src/example-high-mixed-alignment.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { PromptAlignmentMetric } from '@mastra/evals/llm';

const metric = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
  instructions: ['箇条書きを使う', '価格はUSDで記載する', '在庫状況を表示する', '商品説明を追加する'],
});

const query = '在庫のある商品を一覧表示してください';
const response = '• コーヒー - $4.99（在庫あり）\n• 紅茶 - $3.99\n• 水 - $1.99（在庫切れ）';

const result = await metric.measure(query, response);

console.log(result);
```

### 整合性が混在した出力 \{#mixed-alignment-output\}

この応答は、一部の指示には従っている一方で、他の指示には従えていないため、スコアは混在になります。`info` フィールドには、遵守された指示と見落とされた指示の内訳に加え、そのスコアの根拠が含まれます。

```typescript
{
  score: 0.75,
  info: {
    reason: 'スコアが0.75であるのは、箇条書きの使用、USDでの価格の記載、在庫状況の表示など、出力が大半の指示に従っているためです。ただし、製品説明を提供するという指示に完全には沿っておらず、その点が総合スコアに影響しています。',
    scoreDetails: {
      totalInstructions: 4,
      applicableInstructions: 4,
      followedInstructions: 3,
      naInstructions: 0
    }
  }
}
```

## 該当しないアラインメントの例 \{#non-applicable-alignment-example\}

この例では、クエリと無関係なため、応答はどの指示にも従っていません。スコアは、この文脈では指示が適用できなかったことを反映しています。

```typescript filename="src/example-non-applicable-alignment.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { PromptAlignmentMetric } from '@mastra/evals/llm';

const metric = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
  instructions: ['口座残高を表示', '最近の取引を一覧表示', '支払い履歴を表示'],
});

const query = '天気はどうですか？';
const response = '外は晴れて暖かいです。';

const result = await metric.measure(query, response);

console.log(result);
```

### 非該当のアラインメント出力 \{#non-applicable-alignment-output\}

この応答は、どの指示も適用できなかったことを示すスコアを受け取ります。`info` フィールドには、応答とクエリが指示と無関係であるため、整合性を測定できなかったことが記載されています。

```typescript
{
  score: 0,
  info: {
    reason: 'スコアが0である理由は、出力が天気に関する問い合わせの文脈で適用可能な指示に一切従っておらず、提供された指示が入力と無関係だからです。',
    scoreDetails: {
      totalInstructions: 3,
      applicableInstructions: 0,
      followedInstructions: 0,
      naInstructions: 3
    }
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

期待される動作や要件を定義した `instructions` 配列を渡して、`PromptAlignmentMetric` インスタンスを作成できます。`scale` などのオプションパラメータを設定することも可能です。

```typescript showLineNumbers copy
const metric = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
  instructions: [''],
  scale: 1,
});
```

> 設定オプションの全一覧は [PromptAlignmentMetric](/docs/reference/evals/prompt-alignment) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`PromptAlignment` は次の形式の結果を返します：

```typescript
{
  score: number,
  info: {
    reason: string,
    scoreDetails: {
      followed: string[],
      missed: string[],
      notApplicable: string[]
    }
  }
}
```

### プロンプト整合度スコア \{#prompt-alignment-score\}

プロンプト整合度スコアは 0 から 1 の間の値です:

* **1.0**: 完全に整合 — 該当する指示がすべて守られている。
* **0.5–0.8**: 一部整合 — いくつかの指示が守られていない。
* **0.1–0.4**: 低い整合 — ほとんどの指示が守られていない。
* **0.0**: 整合なし — 該当する指示がない、または守られていない。
* **-1**: 該当なし — クエリと無関係な指示。

### プロンプト整合性に関する情報 \{#prompt-alignment-info\}

スコアの説明（以下の詳細を含む）:

* 各指示への遵守状況
* クエリへの適用度の程度
* 準拠・未遵守・非該当の指示の分類
* 整合性スコアの理由

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/prompt-alignment" />