---
title: "リファレンス: Sarvam Voice"
description: "Sarvam クラスのドキュメント。テキスト読み上げ（text-to-speech）および音声テキスト変換（speech-to-text）機能を提供します。"
---

# Sarvam \{#sarvam\}

Mastra の SarvamVoice クラスは、Sarvam AI モデルを利用して、テキスト読み上げ（text-to-speech）と音声認識（speech-to-text）の機能を提供します。

## 使い方の例 \{#usage-example\}

```typescript
import { SarvamVoice } from "@mastra/voice-sarvam";

// 環境変数を用いたデフォルト設定で初期化
const voice = new SarvamVoice();

// あるいは、特定の設定で初期化
const voiceWithConfig = new SarvamVoice({
   speechModel: {
    model: "bulbul:v1",
    apiKey: process.env.SARVAM_API_KEY!,
    language: "en-IN",
    properties: {
      pitch: 0,
      pace: 1.65,
      loudness: 1.5,
      speech_sample_rate: 8000,
      enable_preprocessing: false,
      eng_interpolation_wt: 123,
    },
  },
  listeningModel: {
    model: "saarika:v2",
    apiKey: process.env.SARVAM_API_KEY!,
    languageCode: "en-IN",
     filetype?: 'wav';
  },
  speaker: "meera", // 既定の音声
});


// テキストを音声に変換
const audioStream = await voice.speak("こんにちは。どのようにお手伝いできますか？");


// 音声をテキストに変換
const text = await voice.listen(audioStream, {
  filetype: "wav",
});
```

### Sarvam API ドキュメント \{#sarvam-api-docs\}

https://docs.sarvam.ai/api-reference-docs/endpoints/text-to-speech

## 設定 \{#configuration\}

### コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "SarvamVoiceConfig",
description: "テキスト読み上げ（Text-to-Speech）の設定。",
isOptional: true,
defaultValue: "{ model: 'bulbul:v1', language: 'en-IN' }",
},
{
name: "speaker",
type: "SarvamVoiceId",
description:
"出力音声に使用する話者。指定がない場合は既定でMeeraが使用されます。利用可能なオプション: meera, pavithra, maitreyi, arvind, amol, amartya, diya, neel, misha, vian, arjun, maya",
isOptional: true,
defaultValue: "'meera'",
},
{
name: "listeningModel",
type: "SarvamListenOptions",
description: "音声認識（Speech-to-Text）の設定。",
isOptional: true,
defaultValue: "{ model: 'saarika:v2', language_code: 'unknown' }",
},
]}
/>

### SarvamVoiceConfig \{#sarvamvoiceconfig\}

<PropertiesTable
  content={[
{
name: "apiKey",
type: "string",
description:
"Sarvam の API キー。未指定の場合は SARVAM_API_KEY 環境変数が使用されます。",
isOptional: true,
},
{
name: "model",
type: "SarvamTTSModel",
description: "テキスト読み上げに使用するモデルを指定します。",
isOptional: true,
defaultValue: "'bulbul:v1'",
},
{
name: "language",
type: "SarvamTTSLanguage",
description:
"音声合成の対象言語。利用可能なオプション: hi-IN, bn-IN, kn-IN, ml-IN, mr-IN, od-IN, pa-IN, ta-IN, te-IN, en-IN, gu-IN",
isOptional: false,
defaultValue: "'en-IN'",
},
{
name: "properties",
type: "object",
description: "カスタマイズ用の追加音声プロパティ。",
isOptional: true,
},
{
name: "properties.pitch",
type: "number",
description:
"音声のピッチを制御します。値が小さいほど声は低くなり、大きいほど鋭くなります。推奨範囲は -0.75 ～ 0.75 です。",
isOptional: true,
},
{
name: "properties.pace",
type: "number",
description:
"音声の速度を制御します。値が小さいほど話速は遅くなり、大きいほど速くなります。推奨範囲は 0.5 ～ 2.0。デフォルトは 1.0。許容範囲: 0.3 <= x <= 3",
isOptional: true,
},
{
name: "properties.loudness",
type: "number",
description:
"音声の音量を制御します。値が小さいほど小さく、大きいほど大きくなります。推奨範囲は 0.3 ～ 3.0。許容範囲: 0 <= x <= 3",
isOptional: true,
},
{
name: "properties.speech_sample_rate",
type: "8000 | 16000 | 22050",
description: "音声サンプルレート（Hz）。",
isOptional: true,
},
{
name: "properties.enable_preprocessing",
type: "boolean",
description:
"英単語や数値（例: 数字、日付）の正規化を行うかどうかを制御します。多言語混在テキストの処理を改善するには true に設定します。デフォルトは false です。",
isOptional: true,
},
{
name: "properties.eng_interpolation_wt",
type: "number",
description: "エンコーダで英語話者と補間する際の重み。",
isOptional: true,
},
]}
/>

### SarvamListenOptions \{#sarvamlistenoptions\}

<PropertiesTable
  content={[
{
name: "apiKey",
type: "string",
description:
"Sarvam の API キー。SARVAM_API_KEY 環境変数が設定されている場合はそちらが使用されます。",
isOptional: true,
},
{
name: "model",
type: "SarvamSTTModel",
description:
"音声認識（音声→テキスト変換）に使用するモデルを指定します。注: 既定のモデルは saarika:v2 です。選択可能なオプション: saarika:v1, saarika:v2, saarika:flash",
isOptional: true,
defaultValue: "'saarika:v2'",
},
{
name: "languageCode",
type: "SarvamSTTLanguage",
description:
"入力音声の言語を指定します。正確な文字起こしのために推奨されるパラメータです。saarika:v1 モデルでは必須、saarika:v2 モデルでは任意です。unknown: 言語が不明な場合に使用すると、API が自動検出します。注: saarika:v1 モデルは unknown の言語コードをサポートしません。選択可能なオプション: unknown, hi-IN, bn-IN, kn-IN, ml-IN, mr-IN, od-IN, pa-IN, ta-IN, te-IN, en-IN, gu-IN",
isOptional: true,
defaultValue: "'unknown'",
},
{
name: "filetype",
type: "'mp3' | 'wav'",
description: "入力ストリームの音声形式。",
isOptional: true,
},
]}
/>

## 手法 \{#methods\}

### speak() \{#speak\}

Sarvam のテキスト読み上げ（Text-to-Speech）モデルを使用して、テキストを音声に変換します。

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description: "音声に変換するテキストまたはテキストのストリーム。",
isOptional: false,
},
{
name: "options.speaker",
type: "SarvamVoiceId",
description: "音声合成に使用するボイス ID。",
isOptional: true,
defaultValue: "コンストラクターで指定された speaker の値",
},
]}
/>

Returns: `Promise<NodeJS.ReadableStream>`

### listen() \{#listen\}

Sarvam の音声認識モデルを使って音声をテキスト化します。

<PropertiesTable
  content={[
{
name: "input",
type: "NodeJS.ReadableStream",
description: "テキスト化する音声ストリーム。",
isOptional: false,
},
{
name: "options",
type: "SarvamListenOptions",
description: "音声認識の設定オプション。",
isOptional: true,
},
]}
/>

Returns: `Promise<string>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。

戻り値: `Promise<Array<{voiceId: SarvamVoiceId}>>`

## 注意事項 \{#notes\}

* APIキーはコンストラクタのオプション、または `SARVAM_API_KEY` 環境変数で指定できます
* APIキーが指定されていない場合、コンストラクタはエラーをスローします
* サービスは `https://api.sarvam.ai` にある Sarvam AI API と通信します
* 音声はバイナリ音声データを含むストリームとして返されます
* 音声認識は mp3 および wav の音声形式をサポートします