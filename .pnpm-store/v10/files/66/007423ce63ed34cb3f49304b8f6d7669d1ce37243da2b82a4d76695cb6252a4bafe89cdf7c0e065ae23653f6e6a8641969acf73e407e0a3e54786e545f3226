# Reference

## History

<details><summary><code>client.history.<a href="/src/api/resources/history/client/Client.ts">getAll</a>({ ...params }) -> ElevenLabs.GetSpeechHistoryResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns a list of your generated audio.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.history.getAll();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.HistoryGetAllRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `History.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.history.<a href="/src/api/resources/history/client/Client.ts">get</a>(historyItemId) -> ElevenLabs.SpeechHistoryItemResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieves a history item.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.history.get("VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**historyItemId:** `string` — ID of the history item to be used. You can use the [Get generated items](/docs/api-reference/history/get-all) endpoint to retrieve a list of history items.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `History.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.history.<a href="/src/api/resources/history/client/Client.ts">delete</a>(historyItemId) -> ElevenLabs.DeleteHistoryItemResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Delete a history item by its ID

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.history.delete("VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**historyItemId:** `string` — ID of the history item to be used. You can use the [Get generated items](/docs/api-reference/history/get-all) endpoint to retrieve a list of history items.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `History.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## TextToSoundEffects

<details><summary><code>client.textToSoundEffects.<a href="/src/api/resources/textToSoundEffects/client/Client.ts">convert</a>({ ...params }) -> stream.Readable</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Turn text into sound effects for your videos, voice-overs or video games using the most advanced sound effects model in the world.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.textToSoundEffects.convert({
    text: "Spacious braam suitable for high-impact movie trailer moments",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.CreateSoundEffectRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `TextToSoundEffects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## AudioIsolation

## Samples

<details><summary><code>client.samples.<a href="/src/api/resources/samples/client/Client.ts">delete</a>(voiceId, sampleId) -> ElevenLabs.DeleteSampleResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Removes a sample by its ID.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.samples.delete("21m00Tcm4TlvDq8ikWAM", "VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. You can use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — ID of the sample to be used. You can use the [Get voices](/docs/api-reference/voices/get) endpoint list all the available samples for a voice.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Samples.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## TextToSpeech

<details><summary><code>client.textToSpeech.<a href="/src/api/resources/textToSpeech/client/Client.ts">convert</a>(voiceId, { ...params }) -> stream.Readable</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Converts text into speech using a voice of your choice and returns audio.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
    output_format: "mp3_44100_128",
    text: "The first move is what sets everything in motion.",
    model_id: "eleven_multilingual_v2",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. Use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.TextToSpeechRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `TextToSpeech.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.textToSpeech.<a href="/src/api/resources/textToSpeech/client/Client.ts">convertWithTimestamps</a>(voiceId, { ...params }) -> ElevenLabs.AudioWithTimestampsResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Generate speech from text with precise character-level timing information for audio-text synchronization.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.textToSpeech.convertWithTimestamps("21m00Tcm4TlvDq8ikWAM", {
    text: "This is a test for the API of ElevenLabs.",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.TextToSpeechWithTimestampsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `TextToSpeech.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.textToSpeech.<a href="/src/api/resources/textToSpeech/client/Client.ts">convertAsStream</a>(voiceId, { ...params }) -> stream.Readable</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Converts text into speech using a voice of your choice and returns audio as an audio stream.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.textToSpeech.convertAsStream("JBFqnCBsd6RMkjVDRZzb", {
    output_format: "mp3_44100_128",
    text: "The first move is what sets everything in motion.",
    model_id: "eleven_multilingual_v2",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. Use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.StreamTextToSpeechRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `TextToSpeech.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.textToSpeech.<a href="/src/api/resources/textToSpeech/client/Client.ts">streamWithTimestamps</a>(voiceId, { ...params }) -> core.Stream<ElevenLabs.StreamingAudioChunkWithTimestampsResponse></code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Converts text into speech using a voice of your choice and returns a stream of JSONs containing audio as a base64 encoded string together with information on when which character was spoken.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
const response = await client.textToSpeech.streamWithTimestamps("JBFqnCBsd6RMkjVDRZzb", {
    output_format: "mp3_44100_128",
    text: "The first move is what sets everything in motion.",
    model_id: "eleven_multilingual_v2",
});
for await (const item of response) {
    console.log(item);
}
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. Use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.StreamTextToSpeechWithTimestampsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `TextToSpeech.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## SpeechToSpeech

<details><summary><code>client.speechToSpeech.<a href="/src/api/resources/speechToSpeech/client/Client.ts">convert</a>(voiceId, { ...params }) -> stream.Readable</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Transform audio from one voice to another. Maintain full control over emotion, timing and delivery.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.speechToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
    audio: fs.createReadStream("/path/to/your/file"),
    output_format: "mp3_44100_128",
    model_id: "eleven_multilingual_sts_v2",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodySpeechToSpeechV1SpeechToSpeechVoiceIdPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `SpeechToSpeech.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.speechToSpeech.<a href="/src/api/resources/speechToSpeech/client/Client.ts">convertAsStream</a>(voiceId, { ...params }) -> stream.Readable</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Stream audio from one voice to another. Maintain full control over emotion, timing and delivery.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.speechToSpeech.convertAsStream("JBFqnCBsd6RMkjVDRZzb", {
    audio: fs.createReadStream("/path/to/your/file"),
    output_format: "mp3_44100_128",
    model_id: "eleven_multilingual_sts_v2",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodySpeechToSpeechStreamingV1SpeechToSpeechVoiceIdStreamPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `SpeechToSpeech.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## TextToVoice

<details><summary><code>client.textToVoice.<a href="/src/api/resources/textToVoice/client/Client.ts">createPreviews</a>({ ...params }) -> ElevenLabs.VoiceDesignPreviewResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a voice from a text prompt.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.textToVoice.createPreviews({
    voice_description: "A sassy squeaky mouse",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.VoiceDesignRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `TextToVoice.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.textToVoice.<a href="/src/api/resources/textToVoice/client/Client.ts">createVoiceFromPreview</a>({ ...params }) -> ElevenLabs.Voice</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Add a generated voice to the voice library.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.textToVoice.createVoiceFromPreview({
    voice_name: "Sassy squeaky mouse",
    voice_description: "A sassy squeaky mouse",
    generated_voice_id: "37HceQefKmEi3bGovXjL",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.SaveVoicePreviewRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `TextToVoice.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## User

<details><summary><code>client.user.<a href="/src/api/resources/user/client/Client.ts">getSubscription</a>() -> ElevenLabs.Subscription</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Gets extended information about the users subscription

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.user.getSubscription();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `User.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.user.<a href="/src/api/resources/user/client/Client.ts">get</a>() -> ElevenLabs.User</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Gets information about the user

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.user.get();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `User.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">getAll</a>({ ...params }) -> ElevenLabs.GetVoicesResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns a list of all available voices for a user.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.getAll();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.VoicesGetAllRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">search</a>({ ...params }) -> ElevenLabs.GetVoicesV2Response</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Gets a list of all available voices for a user with search, filtering and pagination.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.search({
    include_total_count: true,
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.VoicesSearchRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">getDefaultSettings</a>() -> ElevenLabs.VoiceSettings</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Gets the default settings for voices. "similarity_boost" corresponds to"Clarity + Similarity Enhancement" in the web app and "stability" corresponds to "Stability" slider in the web app.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.getDefaultSettings();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">getSettings</a>(voiceId) -> ElevenLabs.VoiceSettings</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns the settings for a specific voice. "similarity_boost" corresponds to"Clarity + Similarity Enhancement" in the web app and "stability" corresponds to "Stability" slider in the web app.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.getSettings("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">get</a>(voiceId, { ...params }) -> ElevenLabs.Voice</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns metadata about a specific voice.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.get("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. You can use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.VoicesGetRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">delete</a>(voiceId) -> ElevenLabs.DeleteVoiceResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Deletes a voice by its ID.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.delete("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. You can use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">editSettings</a>(voiceId, { ...params }) -> ElevenLabs.EditVoiceSettingsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Edit your settings for a specific voice. "similarity_boost" corresponds to "Clarity + Similarity Enhancement" in the web app and "stability" corresponds to "Stability" slider in the web app.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.editSettings("21m00Tcm4TlvDq8ikWAM", {
    stability: 1,
    similarity_boost: 1,
    style: 0,
    use_speaker_boost: true,
    speed: 1,
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. You can use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.VoiceSettings`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">add</a>({ ...params }) -> ElevenLabs.AddVoiceIvcResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a voice clone and add it to your Voices

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.add({
    files: [fs.createReadStream("/path/to/your/file")],
    name: "name",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyAddVoiceV1VoicesAddPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">edit</a>(voiceId, { ...params }) -> ElevenLabs.EditVoiceResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Edit a voice created by you.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.edit("21m00Tcm4TlvDq8ikWAM", {
    name: "name",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyEditVoiceV1VoicesVoiceIdEditPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">addSharingVoice</a>(publicUserId, voiceId, { ...params }) -> ElevenLabs.AddVoiceResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Add a shared voice to your collection of Voices

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.addSharingVoice(
    "63e06b7e7cafdc46be4d2e0b3f045940231ae058d508589653d74d1265a574ca",
    "21m00Tcm4TlvDq8ikWAM",
    {
        new_name: "John Smith",
    },
);
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**publicUserId:** `string` — Public user ID used to publicly identify ElevenLabs users.

</dd>
</dl>

<dl>
<dd>

**voiceId:** `string` — ID of the voice to be used. You can use the [Get voices](/docs/api-reference/voices/search) endpoint list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyAddSharedVoiceV1VoicesAddPublicUserIdVoiceIdPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">getShared</a>({ ...params }) -> ElevenLabs.GetLibraryVoicesResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieves a list of shared voices.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.getShared({
    featured: true,
    reader_app_enabled: true,
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.VoicesGetSharedRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.<a href="/src/api/resources/voices/client/Client.ts">getSimilarLibraryVoices</a>({ ...params }) -> ElevenLabs.GetLibraryVoicesResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns a list of shared voices similar to the provided audio sample. If neither similarity_threshold nor top_k is provided, we will apply default values.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.getSimilarLibraryVoices({});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyGetSimilarLibraryVoicesV1SimilarVoicesPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Voices.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Studio

<details><summary><code>client.studio.<a href="/src/api/resources/studio/client/Client.ts">createPodcast</a>({ ...params }) -> ElevenLabs.PodcastProjectResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create and auto-convert a podcast project. Currently, the LLM cost is covered by us but you will still be charged for the audio generation. In the future, you will be charged for both the LLM and audio generation costs.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.createPodcast({
    model_id: "21m00Tcm4TlvDq8ikWAM",
    mode: {
        type: "conversation",
        conversation: {
            host_voice_id: "aw1NgEzBg83R7vgmiJt6",
            guest_voice_id: "aw1NgEzBg83R7vgmiJt7",
        },
    },
    source: {
        text: "This is a test podcast.",
    },
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyCreatePodcastV1StudioPodcastsPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Studio.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Dubbing

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">getDubbingResource</a>(dubbingId) -> ElevenLabs.DubbingResource</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Given a dubbing ID generated from the '/v1/dubbing' endpoint with studio enabled, returns the dubbing resource.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.getDubbingResource("dubbing_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">addLanguageToResource</a>(dubbingId, { ...params }) -> ElevenLabs.LanguageAddedResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Adds the given ElevenLab Turbo V2/V2.5 language code to the resource. Does not automatically generate transcripts/translations/audio.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.addLanguageToResource("dubbing_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyAddALanguageToTheResourceV1DubbingResourceDubbingIdLanguagePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">updateSegmentLanguage</a>(dubbingId, segmentId, language, { ...params }) -> ElevenLabs.SegmentUpdateResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Modifies a single segment with new text and/or start/end times. Will update the values for only a specific language of a segment. Does not automatically regenerate the dub.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.updateSegmentLanguage("dubbing_id", "segment_id", "language");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**segmentId:** `string` — ID of the segment

</dd>
</dl>

<dl>
<dd>

**language:** `string` — ID of the language.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.SegmentUpdatePayload`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">deleteSegment</a>(dubbingId, segmentId) -> ElevenLabs.SegmentDeleteResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Deletes a single segment from the dubbing.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.deleteSegment("dubbing_id", "segment_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**segmentId:** `string` — ID of the segment

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">transcribeSegments</a>(dubbingId, { ...params }) -> ElevenLabs.SegmentTranscriptionResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Regenerate the transcriptions for the specified segments. Does not automatically regenerate translations or dubs.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.transcribeSegments("dubbing_id", {
    segments: ["segments"],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyTranscribesSegmentsV1DubbingResourceDubbingIdTranscribePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">translateSegments</a>(dubbingId, { ...params }) -> ElevenLabs.SegmentTranslationResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Regenerate the translations for either the entire resource or the specified segments/languages. Will automatically transcribe missing transcriptions. Will not automatically regenerate the dubs.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.translateSegments("dubbing_id", {
    segments: ["segments"],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyTranslatesAllOrSomeSegmentsAndLanguagesV1DubbingResourceDubbingIdTranslatePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">dubSegments</a>(dubbingId, { ...params }) -> ElevenLabs.SegmentDubResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Regenerate the dubs for either the entire resource or the specified segments/languages. Will automatically transcribe and translate any missing transcriptions and translations.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.dubSegments("dubbing_id", {
    segments: ["segments"],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyDubsAllOrSomeSegmentsAndLanguagesV1DubbingResourceDubbingIdDubPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">renderDub</a>(dubbingId, language, { ...params }) -> ElevenLabs.DubbingRenderResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Regenerate the dubs for either the entire resource or the specified segments/languages. Will automatically transcribe and translate any missing transcriptions and translations.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.renderDub("dubbing_id", "language", {
    render_type: "mp4",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**language:** `string` — Render this language

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyRenderAudioOrVideoForTheGivenLanguageV1DubbingResourceDubbingIdRenderLanguagePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">dubAVideoOrAnAudioFile</a>({ ...params }) -> ElevenLabs.DoDubbingResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Dubs a provided audio or video file into given language.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.dubAVideoOrAnAudioFile({});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyDubAVideoOrAnAudioFileV1DubbingPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">getDubbingProjectMetadata</a>(dubbingId) -> ElevenLabs.DubbingMetadataResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns metadata about a dubbing project, including whether it's still in progress or not

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.getDubbingProjectMetadata("dubbing_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">deleteDubbingProject</a>(dubbingId) -> ElevenLabs.DeleteDubbingResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Deletes a dubbing project.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.deleteDubbingProject("dubbing_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.<a href="/src/api/resources/dubbing/client/Client.ts">getTranscriptForDub</a>(dubbingId, languageCode, { ...params }) -> string</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns transcript for the dub as an SRT or WEBVTT file.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.getTranscriptForDub("dubbing_id", "language_code");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**languageCode:** `string` — ID of the language.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.DubbingGetTranscriptForDubRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Dubbing.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Models

<details><summary><code>client.models.<a href="/src/api/resources/models/client/Client.ts">getAll</a>() -> ElevenLabs.Model[]</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Gets a list of available models.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.models.getAll();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `Models.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## AudioNative

<details><summary><code>client.audioNative.<a href="/src/api/resources/audioNative/client/Client.ts">create</a>({ ...params }) -> ElevenLabs.AudioNativeCreateProjectResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Creates Audio Native enabled project, optionally starts conversion and returns project ID and embeddable HTML snippet.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.audioNative.create({
    name: "name",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyCreatesAudioNativeEnabledProjectV1AudioNativePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `AudioNative.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.audioNative.<a href="/src/api/resources/audioNative/client/Client.ts">getSettings</a>(projectId) -> ElevenLabs.GetAudioNativeProjectSettingsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get player settings for the specific project.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.audioNative.getSettings("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the Studio project.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `AudioNative.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.audioNative.<a href="/src/api/resources/audioNative/client/Client.ts">updateContent</a>(projectId, { ...params }) -> ElevenLabs.AudioNativeEditContentResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Updates content for the specific AudioNative Project.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.audioNative.updateContent("21m00Tcm4TlvDq8ikWAM", {});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyUpdateAudioNativeProjectContentV1AudioNativeProjectIdContentPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `AudioNative.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Usage

<details><summary><code>client.usage.<a href="/src/api/resources/usage/client/Client.ts">getCharactersUsageMetrics</a>({ ...params }) -> ElevenLabs.UsageCharactersResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns the usage metrics for the current user or the entire workspace they are part of. The response provides a time axis based on the specified aggregation interval (default: day), with usage values for each interval along that axis. Usage is broken down by the selected breakdown type. For example, breakdown type "voice" will return the usage of each voice for each interval along the time axis.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.usage.getCharactersUsageMetrics({
    start_unix: 1,
    end_unix: 1,
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.UsageGetCharactersUsageMetricsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Usage.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## PronunciationDictionary

<details><summary><code>client.pronunciationDictionary.<a href="/src/api/resources/pronunciationDictionary/client/Client.ts">addFromFile</a>({ ...params }) -> ElevenLabs.AddPronunciationDictionaryResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Creates a new pronunciation dictionary from a lexicon .PLS file

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.pronunciationDictionary.addFromFile({
    name: "name",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyAddAPronunciationDictionaryV1PronunciationDictionariesAddFromFilePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `PronunciationDictionary.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.pronunciationDictionary.<a href="/src/api/resources/pronunciationDictionary/client/Client.ts">addFromRules</a>({ ...params }) -> ElevenLabs.AddPronunciationDictionaryResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Creates a new pronunciation dictionary from provided rules.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.pronunciationDictionary.addFromRules({
    rules: [
        {
            type: "alias",
            string_to_replace: "Thailand",
            alias: "tie-land",
        },
    ],
    name: "My Dictionary",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyAddAPronunciationDictionaryV1PronunciationDictionariesAddFromRulesPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `PronunciationDictionary.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.pronunciationDictionary.<a href="/src/api/resources/pronunciationDictionary/client/Client.ts">addRules</a>(pronunciationDictionaryId, { ...params }) -> ElevenLabs.PronunciationDictionaryRulesResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Add rules to the pronunciation dictionary

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.pronunciationDictionary.addRules("21m00Tcm4TlvDq8ikWAM", {
    rules: [
        {
            type: "alias",
            string_to_replace: "Thailand",
            alias: "tie-land",
        },
    ],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**pronunciationDictionaryId:** `string` — The id of the pronunciation dictionary

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.PronunciationDictionary`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `PronunciationDictionary.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.pronunciationDictionary.<a href="/src/api/resources/pronunciationDictionary/client/Client.ts">removeRules</a>(pronunciationDictionaryId, { ...params }) -> ElevenLabs.PronunciationDictionaryRulesResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Remove rules from the pronunciation dictionary

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.pronunciationDictionary.removeRules("21m00Tcm4TlvDq8ikWAM", {
    rule_strings: ["rule_strings"],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**pronunciationDictionaryId:** `string` — The id of the pronunciation dictionary

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.RemovePronunciationDictionaryRulesRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `PronunciationDictionary.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.pronunciationDictionary.<a href="/src/api/resources/pronunciationDictionary/client/Client.ts">get</a>(pronunciationDictionaryId) -> ElevenLabs.GetPronunciationDictionaryMetadataResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get metadata for a pronunciation dictionary

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.pronunciationDictionary.get("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**pronunciationDictionaryId:** `string` — The id of the pronunciation dictionary

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `PronunciationDictionary.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.pronunciationDictionary.<a href="/src/api/resources/pronunciationDictionary/client/Client.ts">getAll</a>({ ...params }) -> ElevenLabs.GetPronunciationDictionariesMetadataResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get a list of the pronunciation dictionaries you have access to and their metadata

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.pronunciationDictionary.getAll();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.PronunciationDictionaryGetAllRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `PronunciationDictionary.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Workspace

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">searchUserGroups</a>({ ...params }) -> ElevenLabs.WorkspaceGroupByNameResponseModel[]</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Searches for user groups in the workspace. Multiple or no groups may be returned.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.searchUserGroups({
    name: "name",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.SearchUserGroupsV1WorkspaceGroupsSearchGetRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">deleteMemberFromUserGroup</a>(groupId, { ...params }) -> ElevenLabs.DeleteWorkspaceGroupMemberResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Removes a member from the specified group. This endpoint may only be called by workspace administrators.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.deleteMemberFromUserGroup("group_id", {
    email: "email",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**groupId:** `string` — The ID of the target group.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyDeleteMemberFromUserGroupV1WorkspaceGroupsGroupIdMembersRemovePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">addMemberToUserGroup</a>(groupId, { ...params }) -> ElevenLabs.AddWorkspaceGroupMemberResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Adds a member of your workspace to the specified group. This endpoint may only be called by workspace administrators.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.addMemberToUserGroup("group_id", {
    email: "email",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**groupId:** `string` — The ID of the target group.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.AddMemberToGroupRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">inviteUser</a>({ ...params }) -> ElevenLabs.AddWorkspaceInviteResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Sends an email invitation to join your workspace to the provided email. If the user doesn't have an account they will be prompted to create one. If the user accepts this invite they will be added as a user to your workspace and your subscription using one of your seats. This endpoint may only be called by workspace administrators. If the user is already in the workspace a 400 error will be returned.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.inviteUser({
    email: "john.doe@testmail.com",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.InviteUserRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">inviteMultipleUsers</a>({ ...params }) -> ElevenLabs.AddWorkspaceInviteResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Sends email invitations to join your workspace to the provided emails. Requires all email addresses to be part of a verified domain. If the users don't have an account they will be prompted to create one. If the users accept these invites they will be added as users to your workspace and your subscription using one of your seats. This endpoint may only be called by workspace administrators.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.inviteMultipleUsers({
    emails: ["emails"],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyInviteMultipleUsersV1WorkspaceInvitesAddBulkPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">deleteExistingInvitation</a>({ ...params }) -> ElevenLabs.DeleteWorkspaceInviteResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Invalidates an existing email invitation. The invitation will still show up in the inbox it has been delivered to, but activating it to join the workspace won't work. This endpoint may only be called by workspace administrators.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.deleteExistingInvitation({
    email: "john.doe@testmail.com",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyDeleteExistingInvitationV1WorkspaceInvitesDelete`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">updateMember</a>({ ...params }) -> ElevenLabs.UpdateWorkspaceMemberResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Updates attributes of a workspace member. Apart from the email identifier, all parameters will remain unchanged unless specified. This endpoint may only be called by workspace administrators.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.updateMember({
    email: "email",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.UpdateMemberRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">deleteMember</a>({ ...params }) -> ElevenLabs.DeleteWorkspaceMemberResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Deletes a workspace member. This endpoint may only be called by workspace administrators.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.deleteMember({
    email: "email",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyDeleteMemberV1WorkspaceMembersDelete`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">getResource</a>(resourceId, { ...params }) -> ElevenLabs.ResourceMetadataResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Gets the metadata of a resource by ID.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.getResource("resource_id", {
    resource_type: "voice",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**resourceId:** `string` — The ID of the target resource.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.GetResourceV1WorkspaceResourcesResourceIdGetRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">shareWorkspaceResource</a>(resourceId, { ...params }) -> unknown</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Grants a role on a workspace resource to a user or a group. It overrides any existing role this user/service account/group/workspace api key has on the resource. To target a user or service account, pass only the user email. The user must be in your workspace. To target a group, pass only the group id. To target a workspace api key, pass the api key id. The resource will be shared with the service account associated with the api key. You must have admin access to the resource to share it.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.shareWorkspaceResource("resource_id", {
    role: "admin",
    resource_type: "voice",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**resourceId:** `string` — The ID of the target resource.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyShareWorkspaceResourceV1WorkspaceResourcesResourceIdSharePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.workspace.<a href="/src/api/resources/workspace/client/Client.ts">unshareWorkspaceResource</a>(resourceId, { ...params }) -> unknown</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Removes any existing role on a workspace resource from a user, service account, group or workspace api key. To target a user or service account, pass only the user email. The user must be in your workspace. To target a group, pass only the group id. To target a workspace api key, pass the api key id. The resource will be unshared from the service account associated with the api key. You must have admin access to the resource to unshare it. You cannot remove permissions from the user who created the resource.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.workspace.unshareWorkspaceResource("resource_id", {
    resource_type: "voice",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**resourceId:** `string` — The ID of the target resource.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyUnshareWorkspaceResourceV1WorkspaceResourcesResourceIdUnsharePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Workspace.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## SpeechToText

<details><summary><code>client.speechToText.<a href="/src/api/resources/speechToText/client/Client.ts">convert</a>({ ...params }) -> ElevenLabs.SpeechToTextChunkResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Transcribe an audio or video file.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.speechToText.convert({
    model_id: "model_id",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodySpeechToTextV1SpeechToTextPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `SpeechToText.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## ForcedAlignment

<details><summary><code>client.forcedAlignment.<a href="/src/api/resources/forcedAlignment/client/Client.ts">create</a>({ ...params }) -> ElevenLabs.ForcedAlignmentResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Force align an audio file to text. Use this endpoint to get the timing information for each character and word in an audio file based on a provided text transcript.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.forcedAlignment.create({
    file: fs.createReadStream("/path/to/your/file"),
    text: "text",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyCreateForcedAlignmentV1ForcedAlignmentPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ForcedAlignment.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## ConversationalAi

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getSignedUrl</a>({ ...params }) -> ElevenLabs.ConversationSignedUrlResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get a signed url to start a conversation with an agent with an agent that requires authorization

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getSignedUrl({
    agent_id: "21m00Tcm4TlvDq8ikWAM",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.ConversationalAiGetSignedUrlRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">twilioOutboundCall</a>({ ...params }) -> ElevenLabs.TwilioOutboundCallResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Handle an outbound call via Twilio

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.twilioOutboundCall({
    agent_id: "agent_id",
    agent_phone_number_id: "agent_phone_number_id",
    to_number: "to_number",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyHandleAnOutboundCallViaTwilioV1ConvaiTwilioOutboundCallPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">createAgent</a>({ ...params }) -> ElevenLabs.CreateAgentResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create an agent from a config object

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.createAgent({
    conversation_config: {},
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyCreateAgentV1ConvaiAgentsCreatePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getAgent</a>(agentId) -> ElevenLabs.GetAgentResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve config for an agent

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getAgent("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">deleteAgent</a>(agentId) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Delete an agent

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.deleteAgent("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">updateAgent</a>(agentId, { ...params }) -> ElevenLabs.GetAgentResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Patches an Agent settings

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.updateAgent("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.UpdateAgentRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getAgentWidget</a>(agentId, { ...params }) -> ElevenLabs.GetAgentEmbedResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve the widget configuration for an agent

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getAgentWidget("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.ConversationalAiGetAgentWidgetRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getAgentLink</a>(agentId) -> ElevenLabs.GetAgentLinkResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get the current link used to share the agent with others

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getAgentLink("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">postAgentAvatar</a>(agentId, { ...params }) -> ElevenLabs.PostAgentAvatarResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Sets the avatar for an agent displayed in the widget

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.postAgentAvatar("21m00Tcm4TlvDq8ikWAM", {
    avatar_file: fs.createReadStream("/path/to/your/file"),
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyPostAgentAvatarV1ConvaiAgentsAgentIdAvatarPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getAgents</a>({ ...params }) -> ElevenLabs.GetAgentsPageResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns a list of your agents and their metadata.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getAgents();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.ConversationalAiGetAgentsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getConversations</a>({ ...params }) -> ElevenLabs.GetConversationsPageResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get all conversations of agents that user owns. With option to restrict to a specific agent.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getConversations();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.ConversationalAiGetConversationsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getConversation</a>(conversationId) -> ElevenLabs.GetConversationResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get the details of a particular conversation

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getConversation("123");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**conversationId:** `string` — The id of the conversation you're taking the action on.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">deleteConversation</a>(conversationId) -> unknown</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Delete a particular conversation

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.deleteConversation("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**conversationId:** `string` — The id of the conversation you're taking the action on.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">postConversationFeedback</a>(conversationId, { ...params }) -> unknown</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Send the feedback for the given conversation

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.postConversationFeedback("21m00Tcm4TlvDq8ikWAM", {
    feedback: "like",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**conversationId:** `string` — The id of the conversation you're taking the action on.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodySendConversationFeedbackV1ConvaiConversationsConversationIdFeedbackPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">createPhoneNumber</a>({ ...params }) -> ElevenLabs.CreatePhoneNumberResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Import Phone Number from provider configuration (Twilio or SIP trunk)

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.createPhoneNumber({
    provider: "twilio",
    phone_number: "phone_number",
    label: "label",
    sid: "sid",
    token: "token",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.ConversationalAiCreatePhoneNumberRequestBody`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getPhoneNumber</a>(phoneNumberId) -> ElevenLabs.ConversationalAiGetPhoneNumberResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve Phone Number details by ID

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getPhoneNumber("TeaqRRdTcIfIu2i7BYfT");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**phoneNumberId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">deletePhoneNumber</a>(phoneNumberId) -> unknown</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Delete Phone Number by ID

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.deletePhoneNumber("TeaqRRdTcIfIu2i7BYfT");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**phoneNumberId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">updatePhoneNumber</a>(phoneNumberId, { ...params }) -> ElevenLabs.ConversationalAiUpdatePhoneNumberResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Update Phone Number details by ID

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.updatePhoneNumber("TeaqRRdTcIfIu2i7BYfT");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**phoneNumberId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.UpdatePhoneNumberRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getPhoneNumbers</a>() -> ElevenLabs.ConversationalAiGetPhoneNumbersResponseItem[]</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve all Phone Numbers

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getPhoneNumbers();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getKnowledgeBaseList</a>({ ...params }) -> ElevenLabs.GetKnowledgeBaseListResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get a list of available knowledge base documents

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getKnowledgeBaseList();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.ConversationalAiGetKnowledgeBaseListRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">addToKnowledgeBase</a>({ ...params }) -> ElevenLabs.AddKnowledgeBaseResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Upload a file or webpage URL to create a knowledge base document. <br> <Note> After creating the document, update the agent's knowledge base by calling [Update agent](/docs/conversational-ai/api-reference/agents/update-agent). </Note>

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.addToKnowledgeBase({});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyAddToKnowledgeBaseV1ConvaiKnowledgeBasePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">createKnowledgeBaseUrlDocument</a>({ ...params }) -> ElevenLabs.AddKnowledgeBaseResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a knowledge base document generated by scraping the given webpage.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.createKnowledgeBaseUrlDocument({
    url: "url",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyCreateUrlDocumentV1ConvaiKnowledgeBaseUrlPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">createKnowledgeBaseFileDocument</a>({ ...params }) -> ElevenLabs.AddKnowledgeBaseResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a knowledge base document generated form the uploaded file.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.createKnowledgeBaseFileDocument({
    file: fs.createReadStream("/path/to/your/file"),
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyCreateFileDocumentV1ConvaiKnowledgeBaseFilePost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">createKnowledgeBaseTextDocument</a>({ ...params }) -> ElevenLabs.AddKnowledgeBaseResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a knowledge base document containing the provided text.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.createKnowledgeBaseTextDocument({
    text: "text",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.BodyCreateTextDocumentV1ConvaiKnowledgeBaseTextPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getKnowledgeBaseDocumentById</a>(documentationId) -> ElevenLabs.ConversationalAiGetKnowledgeBaseDocumentByIdResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get details about a specific documentation making up the agent's knowledge base

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getKnowledgeBaseDocumentById("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**documentationId:** `string` — The id of a document from the knowledge base. This is returned on document addition.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">deleteKnowledgeBaseDocument</a>(documentationId) -> unknown</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Delete a document from the knowledge base

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.deleteKnowledgeBaseDocument("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**documentationId:** `string` — The id of a document from the knowledge base. This is returned on document addition.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">updateKnowledgeBaseDocument</a>(documentationId, { ...params }) -> ElevenLabs.ConversationalAiUpdateKnowledgeBaseDocumentResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Update the name of a document

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.updateKnowledgeBaseDocument("21m00Tcm4TlvDq8ikWAM", {
    name: "name",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**documentationId:** `string` — The id of a document from the knowledge base. This is returned on document addition.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.BodyUpdateDocumentV1ConvaiKnowledgeBaseDocumentationIdPatch`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getDependentAgents</a>(documentationId, { ...params }) -> ElevenLabs.GetKnowledgeBaseDependentAgentsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get a list of agents depending on this knowledge base document

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getDependentAgents("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**documentationId:** `string` — The id of a document from the knowledge base. This is returned on document addition.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.ConversationalAiGetDependentAgentsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getKnowledgeBaseDocumentContent</a>(documentationId) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get the entire content of a document from the knowledge base

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getKnowledgeBaseDocumentContent("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**documentationId:** `string` — The id of a document from the knowledge base. This is returned on document addition.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getKnowledgeBaseDocumentPartById</a>(documentationId, chunkId) -> ElevenLabs.KnowledgeBaseDocumentChunkResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get details about a specific documentation part used by RAG.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getKnowledgeBaseDocumentPartById("21m00Tcm4TlvDq8ikWAM", "chunk_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**documentationId:** `string` — The id of a document from the knowledge base. This is returned on document addition.

</dd>
</dl>

<dl>
<dd>

**chunkId:** `string` — The id of a document RAG chunk from the knowledge base.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getSettings</a>() -> ElevenLabs.GetConvAiSettingsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve Convai settings for the workspace

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getSettings();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">updateSettings</a>({ ...params }) -> ElevenLabs.GetConvAiSettingsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Update Convai settings for the workspace

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.updateSettings();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.PatchConvAiSettingsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getDashboardSettings</a>() -> ElevenLabs.GetConvAiDashboardSettingsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve Convai dashboard settings for the workspace

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getDashboardSettings();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">updateDashboardSettings</a>({ ...params }) -> ElevenLabs.GetConvAiDashboardSettingsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Update Convai dashboard settings for the workspace

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.updateDashboardSettings();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.PatchConvAiDashboardSettingsRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getSecrets</a>() -> ElevenLabs.GetWorkspaceSecretsResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get all workspace secrets for the user

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getSecrets();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">createSecret</a>({ ...params }) -> ElevenLabs.PostWorkspaceSecretResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a new secret for the workspace

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.createSecret({
    name: "name",
    value: "value",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.PostWorkspaceSecretRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">deleteSecret</a>(secretId) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Delete a workspace secret if it's not in use

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.deleteSecret("secret_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**secretId:** `string`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.<a href="/src/api/resources/conversationalAi/client/Client.ts">getBatchCall</a>(batchId) -> ElevenLabs.BatchCallDetailedResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get detailed information about a batch call including all recipients.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.getBatchCall("batch_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**batchId:** `string`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `ConversationalAi.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## ConversationalAi Agents

<details><summary><code>client.conversationalAi.agents.<a href="/src/api/resources/conversationalAi/resources/agents/client/Client.ts">simulateConversation</a>(agentId, { ...params }) -> ElevenLabs.AgentSimulatedChatTestResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Run a conversation between the agent and a simulated user.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.agents.simulateConversation("21m00Tcm4TlvDq8ikWAM", {
    simulation_specification: {
        simulated_user_config: {
            first_message: "Hello, how can I help you today?",
            language: "en",
        },
    },
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.conversationalAi.BodySimulatesAConversationV1ConvaiAgentsAgentIdSimulateConversationPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Agents.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.conversationalAi.agents.<a href="/src/api/resources/conversationalAi/resources/agents/client/Client.ts">simulateConversationStream</a>(agentId, { ...params }) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Run a conversation between the agent and a simulated user and stream back the response. Response is streamed back as partial lists of messages that should be concatenated and once the conversation has complete a single final message with the conversation analysis will be sent.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.agents.simulateConversationStream("21m00Tcm4TlvDq8ikWAM", {
    simulation_specification: {
        simulated_user_config: {
            first_message: "Hello, how can I help you today?",
            language: "en",
        },
    },
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**agentId:** `string` — The id of an agent. This is returned on agent creation.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.conversationalAi.BodySimulatesAConversationStreamV1ConvaiAgentsAgentIdSimulateConversationStreamPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Agents.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## ConversationalAi SipTrunk

<details><summary><code>client.conversationalAi.sipTrunk.<a href="/src/api/resources/conversationalAi/resources/sipTrunk/client/Client.ts">outboundCall</a>({ ...params }) -> ElevenLabs.SipTrunkOutboundCallResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Handle an outbound call via SIP trunk

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.sipTrunk.outboundCall({
    agent_id: "agent_id",
    agent_phone_number_id: "agent_phone_number_id",
    to_number: "to_number",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.conversationalAi.BodyHandleAnOutboundCallViaSipTrunkV1ConvaiSipTrunkOutboundCallPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `SipTrunk.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## ConversationalAi KnowledgeBase Document

<details><summary><code>client.conversationalAi.knowledgeBase.document.<a href="/src/api/resources/conversationalAi/resources/knowledgeBase/resources/document/client/Client.ts">computeRagIndex</a>(documentationId, { ...params }) -> ElevenLabs.RagIndexResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

In case the document is not RAG indexed, it triggers rag indexing task, otherwise it just returns the current status.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.conversationalAi.knowledgeBase.document.computeRagIndex("21m00Tcm4TlvDq8ikWAM", {
    model: "e5_mistral_7b_instruct",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**documentationId:** `string` — The id of a document from the knowledge base. This is returned on document addition.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.conversationalAi.knowledgeBase.RagIndexRequestModel`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Document.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Dubbing Speaker

<details><summary><code>client.dubbing.speaker.<a href="/src/api/resources/dubbing/resources/speaker/client/Client.ts">update</a>(dubbingId, speakerId, { ...params }) -> ElevenLabs.SpeakerUpdatedResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Amend the metadata associated with a speaker, such as their voice. Both voice cloning and using voices from the ElevenLabs library are supported.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.speaker.update("dubbing_id", "speaker_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**speakerId:** `string` — ID of the speaker.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.dubbing.BodyUpdateMetadataForASpeakerV1DubbingResourceDubbingIdSpeakerSpeakerIdPatch`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Speaker.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.dubbing.speaker.<a href="/src/api/resources/dubbing/resources/speaker/client/Client.ts">similarVoices</a>(dubbingId, speakerId) -> ElevenLabs.SimilarVoicesForSpeakerResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Fetch the top 10 similar voices to a speaker, including the voice IDs, names, descriptions, and, where possible, a sample audio recording.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.speaker.similarVoices("dubbing_id", "speaker_id");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**speakerId:** `string` — ID of the speaker.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Speaker.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Dubbing Speaker Segment

<details><summary><code>client.dubbing.speaker.segment.<a href="/src/api/resources/dubbing/resources/speaker/resources/segment/client/Client.ts">create</a>(dubbingId, speakerId, { ...params }) -> ElevenLabs.SegmentCreateResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Creates a new segment in dubbing resource with a start and end time for the speaker in every available language. Does not automatically generate transcripts/translations/audio.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.dubbing.speaker.segment.create("dubbing_id", "speaker_id", {
    start_time: 1.1,
    end_time: 1.1,
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**dubbingId:** `string` — ID of the dubbing project.

</dd>
</dl>

<dl>
<dd>

**speakerId:** `string` — ID of the speaker.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.dubbing.speaker.SegmentCreatePayload`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Segment.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Studio Projects

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">getAll</a>() -> ElevenLabs.GetProjectsResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns a list of your Studio projects with metadata.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.getAll();
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">add</a>({ ...params }) -> ElevenLabs.AddProjectResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Creates a new Studio project, it can be either initialized as blank, from a document or from a URL.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.add({
    name: "name",
    default_title_voice_id: "default_title_voice_id",
    default_paragraph_voice_id: "default_paragraph_voice_id",
    default_model_id: "default_model_id",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.studio.BodyCreateStudioProjectV1StudioProjectsPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">get</a>(projectId) -> ElevenLabs.ProjectExtendedResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns information about a specific Studio project. This endpoint returns more detailed information about a project than `GET /v1/studio`.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.get("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">updateMetadata</a>(projectId, { ...params }) -> ElevenLabs.EditProjectResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Updates the specified Studio project by setting the values of the parameters passed.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.updateMetadata("21m00Tcm4TlvDq8ikWAM", {
    name: "Project 1",
    default_title_voice_id: "21m00Tcm4TlvDq8ikWAM",
    default_paragraph_voice_id: "21m00Tcm4TlvDq8ikWAM",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.studio.BodyUpdateStudioProjectV1StudioProjectsProjectIdPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">delete</a>(projectId) -> ElevenLabs.DeleteProjectResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Deletes a Studio project.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.delete("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">updateContent</a>(projectId, { ...params }) -> ElevenLabs.EditProjectResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Updates Studio project content.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.updateContent("21m00Tcm4TlvDq8ikWAM", {});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.studio.BodyUpdateStudioProjectContentV1StudioProjectsProjectIdContentPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">convert</a>(projectId) -> ElevenLabs.ConvertProjectResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Starts conversion of a Studio project and all of its chapters.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.convert("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">getSnapshots</a>(projectId) -> ElevenLabs.ProjectSnapshotsResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieves a list of snapshots for a Studio project.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.getSnapshots("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the Studio project.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">getProjectSnapshot</a>(projectId, projectSnapshotId) -> ElevenLabs.ProjectSnapshotExtendedResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns the project snapshot.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.getProjectSnapshot("21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the Studio project.

</dd>
</dl>

<dl>
<dd>

**projectSnapshotId:** `string` — The ID of the Studio project snapshot.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.projects.<a href="/src/api/resources/studio/resources/projects/client/Client.ts">updatePronunciationDictionaries</a>(projectId, { ...params }) -> ElevenLabs.CreatePronunciationDictionaryResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Create a set of pronunciation dictionaries acting on a project. This will automatically mark text within this project as requiring reconverting where the new dictionary would apply or the old one no longer does.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.projects.updatePronunciationDictionaries("21m00Tcm4TlvDq8ikWAM", {
    pronunciation_dictionary_locators: [
        {
            pronunciation_dictionary_id: "pronunciation_dictionary_id",
        },
    ],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.studio.BodyCreatePronunciationDictionariesV1StudioProjectsProjectIdPronunciationDictionariesPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Projects.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Studio Chapters

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">getAll</a>(projectId) -> ElevenLabs.GetChaptersResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns a list of a Studio project's chapters.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.getAll("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the Studio project.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">create</a>(projectId, { ...params }) -> ElevenLabs.AddChapterResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Creates a new chapter either as blank or from a URL.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.create("21m00Tcm4TlvDq8ikWAM", {
    name: "Chapter 1",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the Studio project.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.studio.BodyCreateChapterV1StudioProjectsProjectIdChaptersPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">get</a>(projectId, chapterId) -> ElevenLabs.ChapterWithContentResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns information about a specific chapter.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.get("21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**chapterId:** `string` — The ID of the chapter to be used. You can use the [List project chapters](/docs/api-reference/studio/get-chapters) endpoint to list all the available chapters.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">edit</a>(projectId, chapterId, { ...params }) -> ElevenLabs.EditChapterResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Updates a chapter.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.edit("21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**chapterId:** `string` — The ID of the chapter to be used. You can use the [List project chapters](/docs/api-reference/studio/get-chapters) endpoint to list all the available chapters.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.studio.BodyUpdateChapterV1StudioProjectsProjectIdChaptersChapterIdPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">delete</a>(projectId, chapterId) -> ElevenLabs.DeleteChapterResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Deletes a chapter.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.delete("21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**chapterId:** `string` — The ID of the chapter to be used. You can use the [List project chapters](/docs/api-reference/studio/get-chapters) endpoint to list all the available chapters.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">convert</a>(projectId, chapterId) -> ElevenLabs.ConvertChapterResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Starts conversion of a specific chapter.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.convert("21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**chapterId:** `string` — The ID of the chapter to be used. You can use the [List project chapters](/docs/api-reference/studio/get-chapters) endpoint to list all the available chapters.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">getAllSnapshots</a>(projectId, chapterId) -> ElevenLabs.ChapterSnapshotsResponse</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Gets information about all the snapshots of a chapter. Each snapshot can be downloaded as audio. Whenever a chapter is converted a snapshot will automatically be created.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.getAllSnapshots("21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the project to be used. You can use the [List projects](/docs/api-reference/studio/get-projects) endpoint to list all the available projects.

</dd>
</dl>

<dl>
<dd>

**chapterId:** `string` — The ID of the chapter to be used. You can use the [List project chapters](/docs/api-reference/studio/get-chapters) endpoint to list all the available chapters.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.studio.chapters.<a href="/src/api/resources/studio/resources/chapters/client/Client.ts">getChapterSnapshot</a>(projectId, chapterId, chapterSnapshotId) -> ElevenLabs.ChapterSnapshotExtendedResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Returns the chapter snapshot.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.studio.chapters.getChapterSnapshot("21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM", "21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**projectId:** `string` — The ID of the Studio project.

</dd>
</dl>

<dl>
<dd>

**chapterId:** `string` — The ID of the chapter.

</dd>
</dl>

<dl>
<dd>

**chapterSnapshotId:** `string` — The ID of the chapter snapshot.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Chapters.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc

<details><summary><code>client.voices.pvc.<a href="/src/api/resources/voices/resources/pvc/client/Client.ts">create</a>({ ...params }) -> ElevenLabs.AddVoiceResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Creates a new PVC voice with metadata but no samples

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.create({
    name: "John Smith",
    language: "en",
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**request:** `ElevenLabs.voices.CreatePvcVoiceRequest`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Pvc.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.pvc.<a href="/src/api/resources/voices/resources/pvc/client/Client.ts">update</a>(voiceId, { ...params }) -> ElevenLabs.AddVoiceResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Edit PVC voice metadata

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.update("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.voices.BodyEditPvcVoiceV1VoicesPvcVoiceIdPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Pvc.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.pvc.<a href="/src/api/resources/voices/resources/pvc/client/Client.ts">train</a>(voiceId, { ...params }) -> ElevenLabs.StartPvcVoiceTrainingResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Start PVC training process for a voice.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.train("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.voices.BodyRunPvcTrainingV1VoicesPvcVoiceIdTrainPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Pvc.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc Samples

<details><summary><code>client.voices.pvc.samples.<a href="/src/api/resources/voices/resources/pvc/resources/samples/client/Client.ts">create</a>(voiceId, { ...params }) -> ElevenLabs.VoiceSample[]</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Add audio samples to a PVC voice

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.create("21m00Tcm4TlvDq8ikWAM", {
    files: [fs.createReadStream("/path/to/your/file")],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.voices.pvc.BodyAddSamplesToPvcVoiceV1VoicesPvcVoiceIdSamplesPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Samples.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.pvc.samples.<a href="/src/api/resources/voices/resources/pvc/resources/samples/client/Client.ts">update</a>(voiceId, sampleId, { ...params }) -> ElevenLabs.AddVoiceResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Update a PVC voice sample - apply noise removal, or select speaker.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.update("21m00Tcm4TlvDq8ikWAM", "VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — Sample ID to be used

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.voices.pvc.BodyUpdatePvcVoiceSampleV1VoicesPvcVoiceIdSamplesSampleIdPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Samples.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.pvc.samples.<a href="/src/api/resources/voices/resources/pvc/resources/samples/client/Client.ts">delete</a>(voiceId, sampleId) -> ElevenLabs.DeleteVoiceSampleResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Delete a sample from a PVC voice.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.delete("21m00Tcm4TlvDq8ikWAM", "VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — Sample ID to be used

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Samples.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc Verification

<details><summary><code>client.voices.pvc.verification.<a href="/src/api/resources/voices/resources/pvc/resources/verification/client/Client.ts">request</a>(voiceId, { ...params }) -> ElevenLabs.RequestPvcManualVerificationResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Request manual verification for a PVC voice.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.verification.request("21m00Tcm4TlvDq8ikWAM", {
    files: [fs.createReadStream("/path/to/your/file")],
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.voices.pvc.BodyRequestManualVerificationV1VoicesPvcVoiceIdVerificationPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Verification.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc Samples Audio

<details><summary><code>client.voices.pvc.samples.audio.<a href="/src/api/resources/voices/resources/pvc/resources/samples/resources/audio/client/Client.ts">get</a>(voiceId, sampleId) -> ElevenLabs.VoiceSamplePreviewResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve the first 30 seconds of voice sample audio with or without noise removal.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.audio.get("21m00Tcm4TlvDq8ikWAM", "VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — Sample ID to be used

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Audio.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc Samples Waveform

<details><summary><code>client.voices.pvc.samples.waveform.<a href="/src/api/resources/voices/resources/pvc/resources/samples/resources/waveform/client/Client.ts">get</a>(voiceId, sampleId) -> ElevenLabs.VoiceSampleVisualWaveformResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve the visual waveform of a voice sample.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.waveform.get("21m00Tcm4TlvDq8ikWAM", "VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — Sample ID to be used

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Waveform.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc Samples Speakers

<details><summary><code>client.voices.pvc.samples.speakers.<a href="/src/api/resources/voices/resources/pvc/resources/samples/resources/speakers/client/Client.ts">get</a>(voiceId, sampleId) -> ElevenLabs.SpeakerSeparationResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve the status of the speaker separation process and the list of detected speakers if complete.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.speakers.get("21m00Tcm4TlvDq8ikWAM", "VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — Sample ID to be used

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Speakers.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.pvc.samples.speakers.<a href="/src/api/resources/voices/resources/pvc/resources/samples/resources/speakers/client/Client.ts">separate</a>(voiceId, sampleId) -> ElevenLabs.StartSpeakerSeparationResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Start speaker separation process for a sample

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.speakers.separate("21m00Tcm4TlvDq8ikWAM", "VW7YKqPnjY4h39yTbx2L");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — Sample ID to be used

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Speakers.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc Samples Speakers Audio

<details><summary><code>client.voices.pvc.samples.speakers.audio.<a href="/src/api/resources/voices/resources/pvc/resources/samples/resources/speakers/resources/audio/client/Client.ts">get</a>(voiceId, sampleId, speakerId) -> ElevenLabs.SpeakerAudioResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Retrieve the separated audio for a specific speaker.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.samples.speakers.audio.get(
    "21m00Tcm4TlvDq8ikWAM",
    "VW7YKqPnjY4h39yTbx2L",
    "VW7YKqPnjY4h39yTbx2L",
);
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**sampleId:** `string` — Sample ID to be used

</dd>
</dl>

<dl>
<dd>

**speakerId:** `string` — Speaker ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id}/samples/{sample_id}/speakers to list all the available speakers for a sample.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Audio.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

## Voices Pvc Verification Captcha

<details><summary><code>client.voices.pvc.verification.captcha.<a href="/src/api/resources/voices/resources/pvc/resources/verification/resources/captcha/client/Client.ts">get</a>(voiceId) -> void</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Get captcha for PVC voice verification.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.verification.captcha.get("21m00Tcm4TlvDq8ikWAM");
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string` — Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Captcha.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>

<details><summary><code>client.voices.pvc.verification.captcha.<a href="/src/api/resources/voices/resources/pvc/resources/verification/resources/captcha/client/Client.ts">verify</a>(voiceId, { ...params }) -> ElevenLabs.VerifyPvcVoiceCaptchaResponseModel</code></summary>
<dl>
<dd>

#### 📝 Description

<dl>
<dd>

<dl>
<dd>

Submit captcha verification for PVC voice.

</dd>
</dl>
</dd>
</dl>

#### 🔌 Usage

<dl>
<dd>

<dl>
<dd>

```typescript
await client.voices.pvc.verification.captcha.verify("21m00Tcm4TlvDq8ikWAM", {
    recording: fs.createReadStream("/path/to/your/file"),
});
```

</dd>
</dl>
</dd>
</dl>

#### ⚙️ Parameters

<dl>
<dd>

<dl>
<dd>

**voiceId:** `string`

</dd>
</dl>

<dl>
<dd>

**request:** `ElevenLabs.voices.pvc.verification.BodyVerifyPvcVoiceCaptchaV1VoicesPvcVoiceIdCaptchaPost`

</dd>
</dl>

<dl>
<dd>

**requestOptions:** `Captcha.RequestOptions`

</dd>
</dl>
</dd>
</dl>

</dd>
</dl>
</details>
