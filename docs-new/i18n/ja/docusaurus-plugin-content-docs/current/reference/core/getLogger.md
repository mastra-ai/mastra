---
title: "Mastra.getLogger() "
description: "Mastra の `Mastra.getLogger()` メソッドに関するドキュメント。設定済みのロガーインスタンスを取得します。"
---

# Mastra.getLogger() \{#mastragetlogger\}

`.getLogger()` メソッドは、Mastra インスタンスで構成されたロガーインスタンスを取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getLogger();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "logger",
type: "TLogger",
description: "すべてのコンポーネント（エージェント、ワークフローなど）でのロギングに用いられる、設定済みの logger インスタンス。",
},
]}
/>

## 関連情報 \{#related\}

* [ロギングの概要](/docs/observability/logging)
* [Logger リファレンス](/docs/reference/observability/logging/pino-logger)