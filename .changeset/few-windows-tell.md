---
'@mastra/voice-sarvam': minor
---

Added support for Sarvam's current TTS and STT models. Previously the package only supported the now-deprecated bulbul:v1 and saarika:v1/v2/flash models, which Sarvam has retired.

**What's new:**

- TTS models: `bulbul:v2`, `bulbul:v3` (default), and `bulbul:v3-beta`. `bulbul:v3` and `bulbul:v3-beta` support 39 speakers; `bulbul:v2` supports 7 speakers.
- STT models: `saarika:v2.5` (default) and `saaras:v3`. `saaras:v3` is a multi-mode model that supports `transcribe`, `translate`, `verbatim`, `translit`, and `codemix` via a new `mode` option.
- New bulbul:v3 parameters: `temperature`, `dict_id`, `output_audio_codec`.
- Expanded `speech_sample_rate` options: 8000, 16000, 22050, 24000, 32000, 44100, 48000.

**Breaking changes:**

- Removed the deprecated `bulbul:v1` TTS model and its speakers (`meera`, `pavithra`, `maitreyi`, `arvind`, `amol`, `amartya`, `diya`, `neel`, `misha`, `vian`, `arjun`, `maya`). Sarvam has retired the underlying API.
- Removed the deprecated `saarika:v1`, `saarika:v2`, and `saarika:flash` STT models.
- The default TTS model is now `bulbul:v3` and the default speaker is `shubh`. Speakers are not interchangeable between bulbul versions — each has its own catalog.
- The TTS request body now sends `text` (single string) instead of `inputs` (array), matching Sarvam's current API.

**Migration:**

Before:

```typescript
const voice = new SarvamVoice({
  speechModel: { model: 'bulbul:v1', language: 'en-IN' },
  speaker: 'meera',
  listeningModel: { model: 'saarika:v2' },
});
```

After:

```typescript
const voice = new SarvamVoice({
  speechModel: { model: 'bulbul:v3', language: 'en-IN' },
  speaker: 'shubh',
  listeningModel: { model: 'saarika:v2.5' },
});

// Or use saaras:v3 for speech translation:
await voice.listen(audio, { model: 'saaras:v3', mode: 'translate' });
```

Resolves #15188.
