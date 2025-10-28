---
title: "Mastra.setLogger() "
description: "Mastra の `Mastra.setLogger()` メソッドに関するドキュメント。エージェント、ワークフローなど、すべてのコンポーネントのロガーを設定します。"
---

# Mastra.setLogger() \{#mastrasetlogger\}

`.setLogger()` メソッドは、Mastra インスタンス内のすべてのコンポーネント（エージェント、ワークフローなど）のロガーを設定します。このメソッドは、logger プロパティを持つオブジェクトを1つだけ引数に取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.setLogger({ logger: new PinoLogger({ name: 'testLogger' }) });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ logger: TLogger }",
description: "すべてのコンポーネントに適用する logger インスタンスを格納したオブジェクト。",
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
name: "logger",
type: "TLogger",
description: "すべてのコンポーネント（エージェント、ワークフローなど）に設定するロガーインスタンス。",
},
]}
/>

## 戻り値 \{#returns\}

このメソッドは値を返しません。

## 関連情報 \{#related\}

* [ロギングの概要](/docs/observability/logging)
* [ロガー リファレンス](/docs/reference/observability/logging/pino-logger)