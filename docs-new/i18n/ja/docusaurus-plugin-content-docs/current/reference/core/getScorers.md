---
title: "リファレンス: getScorers()"
description: "Mastra の `getScorers()` メソッドのドキュメント。AI 出力の評価に使用する、登録済みのすべてのスコアラーを返します。"
---

# getScorers() \{#getscorers\}

`getScorers()` メソッドは、Mastra インスタンスに登録されているすべてのスコアラーを返します。スコアラーは AI の出力評価に使用され、エージェント生成やワークフロー実行の際に既定のスコアラーを置き換えることができます。

## 使い方の例 \{#usage-example\}

```typescript
import { mastra } from './mastra';

// 登録されているすべてのスコアラーを取得
const allScorers = mastra.getScorers();

// 特定のスコアラーにアクセス
const myScorer = allScorers.relevancyScorer;
```

## パラメーター \{#parameters\}

このメソッドはパラメーターを取りません。

## 返却値 \{#returns\}

<PropertiesTable
  content={[
{
name: "scorers",
type: "Record<string, MastraScorer> | undefined",
description: "登録済みのすべての scorer を格納したオブジェクト。キーは scorer 名、値は MastraScorer インスタンス。scorer が1件も登録されていない場合は undefined を返します。",
},
]}
/>

## 関連 \{#related\}

* [getScorer()](/docs/reference/core/getScorer) - キーで特定のスコアラーを取得
* [getScorerByName()](/docs/reference/core/getScorerByName) - name プロパティでスコアラーを取得
* [Scorers Overview](/docs/scorers/overview) - スコアラーの作成と使用方法を学ぶ