---
title: "getScorer() "
description: "Mastra の `getScorer()` メソッドに関するドキュメント。登録キーを指定して特定のスコアラーを取得します。"
---

# getScorer() \{#getscorer\}

`getScorer()` メソッドは、登録キーを使って Mastra インスタンスに登録された特定のスコアラーを取得します。このメソッドはスコアラーへの型安全なアクセスを提供し、要求されたスコアラーが見つからない場合はエラーを送出します。

## 使い方の例 \{#usage-example\}

```typescript
import { mastra } from './mastra';

// キーを指定してスコアラーを取得
const relevancyScorer = mastra.getScorer('relevancyScorer');

const weatherAgent = mastra.getAgent('weatherAgent');

// スコアラーを使用してAI出力を評価
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
name: "key",
type: "string",
description: "取得するスコアラーの登録キー。Mastra のコンストラクターでスコアラーを登録した際に使用したキーと一致している必要があります。",
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
description: "指定したキーに対応する MastraScorer インスタンス。",
},
]}
/>

## エラー処理 \{#error-handling\}

このメソッドは、次の場合に `MastraError` をスローします：

* 指定されたキーに対応するスコアラーが見つからない場合
* Mastra インスタンスにスコアラーが1つも登録されていない場合

```typescript
try {
  const scorer = mastra.getScorer('nonExistentScorer');
} catch (error) {
  if (error.id === 'MASTRA_GET_SCORER_NOT_FOUND') {
    console.log('スコアラーが見つかりません。デフォルトの評価を使用します');
  }
}
```

## 関連 \{#related\}

* [getScorers()](/docs/reference/core/getScorers) - 登録されているすべてのスコアラーを取得する
* [getScorerByName()](/docs/reference/core/getScorerByName) - name プロパティで指定したスコアラーを取得する
* [Custom Scorers](/docs/scorers/custom-scorers) - カスタムスコアラーの作り方を学ぶ