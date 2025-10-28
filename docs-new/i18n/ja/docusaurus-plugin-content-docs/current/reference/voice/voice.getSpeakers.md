---
title: "voice.getSpeakers() "
description: "音声プロバイダーで利用できる getSpeakers() メソッドのドキュメント。利用可能な音声オプションを取得します。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# voice.getSpeakers() \{#voicegetspeakers\}

`getSpeakers()` メソッドは、音声プロバイダーから利用可能な音声（スピーカー）の一覧を取得します。これにより、アプリケーションはユーザーに音声の選択肢を提示したり、用途に応じて最適な音声をプログラムから選択したりできます。

## 使用例 \{#usage-example\}

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';
import { ElevenLabsVoice } from '@mastra/voice-elevenlabs';

// 音声プロバイダーを初期化
const openaiVoice = new OpenAIVoice();
const elevenLabsVoice = new ElevenLabsVoice({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// OpenAI で利用可能なボイス一覧を取得
const openaiSpeakers = await openaiVoice.getSpeakers();
console.log('OpenAI のボイス:', openaiSpeakers);
// 出力例: [{ voiceId: "alloy" }, { voiceId: "echo" }, { voiceId: "fable" }, ...]

// ElevenLabs で利用可能なボイス一覧を取得
const elevenLabsSpeakers = await elevenLabsVoice.getSpeakers();
console.log('ElevenLabs のボイス:', elevenLabsSpeakers);
// 出力例: [{ voiceId: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" }, ...]

// 特定のボイスで読み上げ
const text = 'こんにちは。これは複数のボイスをテストする文章です。';
await openaiVoice.speak(text, { speaker: openaiSpeakers[2].voiceId });
await elevenLabsVoice.speak(text, { speaker: elevenLabsSpeakers[0].voiceId });
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#return-value\}

<PropertiesTable
  content={[
{
name: "Promise<Array<{ voiceId: string } & TSpeakerMetadata>>",
type: "Promise",
description:
"各要素が少なくとも voiceId プロパティを持ち、必要に応じてプロバイダー固有のメタデータを含む、音声オプションの配列に解決される Promise です。",
},
]}
/>

## プロバイダー固有のメタデータ \{#provider-specific-metadata\}

音声プロバイダーごとに、利用できるメタデータは異なります。

<Tabs>
  <TabItem value="OpenAI" label="OpenAI">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の一意の識別子（例：'alloy'、'echo'、'fable'、'onyx'、'nova'、'shimmer'）",
}
]}
    />
  </TabItem>

  <TabItem value="openai-realtime" label="OpenAI リアルタイム">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description:
    "音声の固有識別子（例：「alloy」「echo」「fable」「onyx」「nova」「shimmer」）",
},
]}
    />
  </TabItem>

  <TabItem value="Deepgram" label="Deepgram">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の固有識別子",
},
{
  name: "language",
  type: "string",
  description: "voiceId に含まれる言語コード（例: 'en'）",
},
]}
    />
  </TabItem>

  <TabItem value="ElevenLabs" label="ElevenLabs">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の一意の識別子",
},
{
  name: "name",
  type: "string",
  description: "音声のわかりやすい名称",
},
{
  name: "category",
  type: "string",
  description: "音声のカテゴリ（例：「premade」「cloned」）",
},
]}
    />
  </TabItem>

  <TabItem value="Google" label="Google">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の一意の識別子",
},
{
  name: "languageCodes",
  type: "string[]",
  description:
    "音声が対応する言語コードの配列（例：['en-US']）",
},
]}
    />
  </TabItem>

  <TabItem value="Azure" label="Azure（アジュール）">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の一意な識別子",
},
{
  name: "language",
  type: "string",
  description: "voiceId から抽出された言語コード（例：'en'）",
},
{
  name: "region",
  type: "string",
  description: "voiceId から抽出された地域コード（例：'US'）",
},
]}
    />
  </TabItem>

  <TabItem value="murf" label="Murf">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の固有識別子",
},
{
  name: "name",
  type: "string",
  description: "音声名（voiceId と同じ）",
},
{
  name: "language",
  type: "string",
  description: "voice ID から抽出される言語コード（例: 'en'）",
},
{
  name: "gender",
  type: "string",
  description:
    "音声の性別（現行の実装では常に 'neutral'）",
},
]}
    />
  </TabItem>

  <TabItem value="playai" label="PlayAI">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description:
    "音声の一意の識別子（manifest.json への S3 URL）",
},
{
  name: "name",
  type: "string",
  description:
    "音声の人間が読みやすい名前（例：'Angelo'、'Arsenio'）",
},
{
  name: "accent",
  type: "string",
  description:
    "音声のアクセント（例：'US'、'Irish'、'US African American'）",
},
{
  name: "gender",
  type: "string",
  description: "音声の性別（'M' または 'F'）",
},
{
  name: "age",
  type: "string",
  description: "音声の年齢区分（例：'Young'、'Middle'）",
},
{
  name: "style",
  type: "string",
  description: "音声の話し方（例：'Conversational'）",
},
]}
    />
  </TabItem>

  <TabItem value="Speechify" label="Speechify">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の一意の識別子",
},
{
  name: "name",
  type: "string",
  description: "音声の人間が判読可能な名前",
},
{
  name: "language",
  type: "string",
  description: "音声の言語コード（例: 'en-US'）",
},
]}
    />
  </TabItem>

  <TabItem value="sarvam" label="Sarvam">
    <PropertiesTable
      content={[
{
  name: "voiceId",
  type: "string",
  description: "音声の一意の識別子",
},
{
  name: "name",
  type: "string",
  description: "音声の人間にとって読みやすい名称",
},
{
  name: "language",
  type: "string",
  description: "音声の言語（例: 'english'、'hindi'）",
},
{
  name: "gender",
  type: "string",
  description: "音声の性別（'male' または 'female'）",
}
]}
    />
  </TabItem>
</Tabs>

## 注意事項 \{#notes\}

* 利用可能な音声はプロバイダーによって大きく異なります
* 一部のプロバイダーでは、音声の完全な一覧を取得するには認証が必要な場合があります
* 既定の実装では、プロバイダーがこのメソッドに対応していない場合は空配列を返します
* パフォーマンスの観点から、リストを頻繁に表示する必要がある場合は結果のキャッシュを検討してください
* `voiceId` プロパティはすべてのプロバイダーで必ず存在しますが、追加のメタデータはプロバイダーごとに異なります