---
title: "Agent.getVoice()"
description: "Mastra のエージェントにおける `Agent.getVoice()` メソッドのドキュメント。音声機能用の音声プロバイダーを取得します。"
---

# Agent.getVoice() \{#agentgetvoice\}

`.getVoice()` メソッドは、エージェントに設定された音声プロバイダを取得し、関数である場合はその結果を解決して返します。このメソッドは、テキスト読み上げ（TTS）および音声認識（STT）のためのエージェントの音声機能へアクセスする際に使用されます。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getVoice();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ runtimeContext?: RuntimeContext }",
isOptional: true,
defaultValue: "{}",
description: "実行時コンテキストを含む任意の設定オブジェクト。",
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "voice",
type: "Promise<MastraVoice>",
description: "エージェントに設定された音声プロバイダー、または設定されていない場合はデフォルトの音声プロバイダーに解決される Promise。",
},
]}
/>

## 応用例 \{#extended-usage-example\}

```typescript copy
await agent.getVoice({
  runtimeContext: new RuntimeContext(),
});
```

### オプションパラメータ \{#options-parameters\}

<PropertiesTable
  content={[
{
name: "runtimeContext",
type: "RuntimeContext",
isOptional: true,
defaultValue: "new RuntimeContext()",
description: "依存性注入やコンテキスト情報のためのランタイムコンテキスト。",
},
]}
/>

## 関連項目 \{#related\}

* [エージェントに音声を追加する](/docs/agents/adding-voice)
* [音声プロバイダー](../voice/mastra-voice)