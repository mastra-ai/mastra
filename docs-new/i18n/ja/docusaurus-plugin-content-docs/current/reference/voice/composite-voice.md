---
title: "リファレンス: CompositeVoice"
description: "複数の音声プロバイダーを組み合わせて、柔軟に音声合成（text-to-speech）と音声認識（speech-to-text）を行える CompositeVoice クラスのドキュメント。"
---

# CompositeVoice \{#compositevoice\}

CompositeVoice クラスは、テキスト読み上げ（text-to-speech）と音声認識（speech-to-text）の各処理で、異なる音声プロバイダーを組み合わせて利用できるようにします。これは、処理ごとに最適なプロバイダーを選びたい場合に特に有用です。たとえば、speech-to-text には OpenAI を、text-to-speech には PlayAI を使う、といった使い分けが可能です。

CompositeVoice は、柔軟な音声機能を提供するために、Agent クラス内部で使用されています。

## 使い方の例 \{#usage-example\}

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIVoice } from '@mastra/voice-openai';
import { PlayAIVoice } from '@mastra/voice-playai';

// 音声プロバイダーを作成
const openai = new OpenAIVoice();
const playai = new PlayAIVoice();

// リスニング(音声認識)にはOpenAI、スピーキング(音声合成)にはPlayAIを使用
const voice = new CompositeVoice({
  input: openai,
  output: playai,
});

// OpenAIを使用して音声をテキストに変換
const text = await voice.listen(audioStream);

// PlayAIを使用してテキストを音声に変換
const audio = await voice.speak('Hello, world!');
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "config",
type: "object",
description: "複合音声サービスの設定オブジェクト",
isOptional: false,
},
{
name: "config.input",
type: "MastraVoice",
description: "音声認識（音声→テキスト）に使用する音声プロバイダー",
isOptional: true,
},
{
name: "config.output",
type: "MastraVoice",
description: "音声合成（テキスト→音声）に使用する音声プロバイダー",
isOptional: true,
},
]}
/>

## メソッド \{#methods\}

### speak() \{#speak\}

設定済みの音声合成プロバイダーを使用して、テキストを音声に変換します。

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description: "音声に変換するテキスト",
isOptional: false,
},
{
name: "options",
type: "object",
description: "音声合成プロバイダーに渡すプロバイダー固有のオプション",
isOptional: true,
},
]}
/>

注意:

* 音声合成プロバイダーが設定されていない場合、このメソッドはエラーをスローします
* options は設定済みの音声合成プロバイダーにそのまま渡されます
* 音声データのストリームを返します

### listen() \{#listen\}

設定済みのリッスン・プロバイダーを使用して、音声をテキストに変換します。

<PropertiesTable
  content={[
{
name: "audioStream",
type: "NodeJS.ReadableStream",
description: "テキストに変換する音声ストリーム",
isOptional: false,
},
{
name: "options",
type: "object",
description: "リッスン・プロバイダーに渡すプロバイダー固有のオプション",
isOptional: true,
},
]}
/>

Notes:

* リッスン・プロバイダーが設定されていない場合、このメソッドはエラーをスローします
* options は設定済みのリッスン・プロバイダーにそのまま渡されます
* プロバイダーによっては、戻り値は文字列または書き起こしテキストのストリームになります

### getSpeakers() \{#getspeakers\}

音声プロバイダーから利用可能なボイスの一覧を返します。各ノードには次の内容が含まれます:

<PropertiesTable
  content={[
{
name: "voiceId",
type: "string",
description: "ボイスの一意の識別子",
isOptional: false,
},
{
name: "key",
type: "value",
description:
"プロバイダーごとに異なる追加のボイスプロパティ（例：name、language）",
isOptional: true,
},
]}
/>

Notes:

* 音声プロバイダー由来のボイスのみを返します
* 音声プロバイダーが設定されていない場合は空配列を返します
* 各ボイスオブジェクトには少なくとも voiceId プロパティがあります
* 追加のボイスプロパティは音声プロバイダーに依存します