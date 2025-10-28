---
title: "リファレンス: getScorerByName()"
description: "Mastra の `getScorerByName()` メソッドのドキュメント。登録キーではなく、name プロパティでスコアラーを取得します。"
---

# getScorerByName() \{#getscorerbyname\}

`getScorerByName()` メソッドは、登録キーではなく `name` プロパティを基に検索してスコアラーを取得します。Mastra インスタンスでの登録名は分からないが、スコアラーの表示名は分かっている場合に便利です。

## 使い方の例 \{#usage-example\}

```typescript
import { mastra } from './mastra';

// name プロパティでスコアラーを取得
const relevancyScorer = mastra.getScorerByName('Answer Relevancy');

const weatherAgent = mastra.getAgent('weatherAgent');

// スコアラーを使用して AI 出力を評価
await weatherAgent.generate('ローマの天気はどうですか', {
  scorers: {
    answerRelevancy: {
      scorer: relevancyScorer,
    },
  },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "取得するスコアラーの name プロパティ。createScorer() でスコアラーを作成した際に指定した 'name' フィールドと一致している必要があります。",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "scorer",
type: "MastraScorer",
description: "name プロパティが一致する MastraScorer のインスタンス。",
},
]}
/>

## エラーハンドリング \{#error-handling\}

このメソッドは、以下の場合に `MastraError` をスローします。

* 指定した名前のスコアラーが見つからない場合
* Mastra インスタンスにスコアラーが一つも登録されていない場合

```typescript
try {
  const scorer = mastra.getScorerByName('存在しないスコアラー');
} catch (error) {
  if (error.id === 'MASTRA_GET_SCORER_BY_NAME_NOT_FOUND') {
    console.log('指定された名前のスコアラーは見つかりませんでした');
  }
}
```

## 関連 \{#related\}

* [getScorer()](/docs/reference/core/getScorer) - 登録キーでスコアラーを取得
* [getScorers()](/docs/reference/core/getScorers) - 登録済みのスコアラーをすべて取得
* [createScorer()](/docs/reference/scorers/create-scorer) - 名前付きスコアラーの作成方法