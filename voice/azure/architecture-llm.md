# Architecture Documentation: @mastra/voice-azure

## Overview

The `@mastra/voice-azure` package is a Mastra integration that provides bidirectional voice capabilities (Text-to-Speech and Speech-to-Text) using Microsoft Azure's Cognitive Services Speech SDK. It extends the base `MastraVoice` class from `@mastra/core` to provide a standardized interface for voice interactions within the Mastra ecosystem.

**Package Version**: 0.11.0-beta.0
**Primary Dependency**: `microsoft-cognitiveservices-speech-sdk` (v1.45.0)

## Core Architecture

### High-Level Component Structure

```
AzureVoice (Main Class)
├── extends MastraVoice (from @mastra/core)
├── Dependencies
│   ├── microsoft-cognitiveservices-speech-sdk
│   └── Node.js stream API
├── Configuration
│   ├── speechModel (TTS configuration)
│   └── listeningModel (STT configuration)
└── Static Data
    └── AZURE_VOICES (200+ voice definitions)
```

### File Organization

```
/src
  ├── index.ts          # Main AzureVoice class implementation
  ├── voices.ts         # Static voice definitions (~200+ voices)
  └── index.test.ts     # Integration test suite
```

## Class: AzureVoice

### Inheritance

`AzureVoice` extends `MastraVoice` from `@mastra/core/voice`, which provides the abstract interface that all Mastra voice providers must implement.

### Private State

The class maintains four private properties:

1. **`speechConfig?: Azure.SpeechConfig`** - Configuration for TTS operations
2. **`listeningConfig?: Azure.SpeechConfig`** - Configuration for STT operations
3. **`speechSynthesizer?: Azure.SpeechSynthesizer`** - TTS synthesizer instance
4. **`speechRecognizer?: Azure.SpeechRecognizer`** - STT recognizer instance

### Constructor Configuration

The constructor accepts an optional configuration object with three properties:

```typescript
{
  speechModel?: {
    apiKey?: string      // Azure Speech Services API key
    region?: string      // Azure region (e.g., 'eastus')
    voiceName?: string   // Default voice (e.g., 'en-US-AriaNeural')
    language?: string    // Not used for speech synthesis
  },
  listeningModel?: {
    apiKey?: string      // Azure Speech Services API key
    region?: string      // Azure region
    language?: string    // Recognition language (e.g., 'en-US')
    voiceName?: string   // Not used for speech recognition
  },
  speaker?: VoiceId      // Default speaker voice ID
}
```

### Configuration Initialization Flow

1. **Environment Variable Fallback**: Both `apiKey` and `region` fall back to `AZURE_API_KEY` and `AZURE_REGION` environment variables
2. **Validation**: Constructor throws errors if required credentials are missing
3. **Dual Configuration**: Speech synthesis and recognition are configured independently
4. **Default Voice**: Speech synthesis defaults to `'en-US-AriaNeural'` if no voice is specified
5. **SDK Initialization**: Creates Azure SDK instances (`SpeechConfig`, `SpeechSynthesizer`, `SpeechRecognizer`) during construction

## Public Methods

### 1. getSpeakers()

**Purpose**: Returns a list of available voice speakers

**Returns**: `Promise<Array<{ voiceId: string; language: string; region: string; }>>`

**Implementation**:

- Maps over the static `AZURE_VOICES` array
- Parses voice IDs to extract language and region (format: `{lang}-{region}-{name}Neural`)
- Returns metadata for all 200+ available voices

**Note**: This is a synchronous operation wrapped in a promise for API consistency

### 2. speak(input, options?)

**Purpose**: Converts text to speech (TTS)

**Parameters**:

- `input: string | NodeJS.ReadableStream` - Text to synthesize
- `options?: { speaker?: string; [key: string]: any }` - Optional parameters

**Returns**: `Promise<NodeJS.ReadableStream>` - Audio stream in WAV format

**Data Flow**:

```
Input Text/Stream
    ↓
[Stream Conversion] (if input is stream)
    ↓
[Text Validation] (check if empty)
    ↓
[Voice Configuration] (apply speaker option if provided)
    ↓
[Azure SDK Synthesis] (speakTextAsync)
    ↓
[Result Validation] (check ResultReason)
    ↓
[Buffer Wrapping] (convert audioData to Readable stream)
    ↓
Output Audio Stream
```

**Error Handling**:

- Throws if `speechConfig` is not initialized
- Handles stream reading errors
- Validates input text is not empty
- Implements 5-second timeout using `Promise.race`
- Properly closes synthesizer in finally block
- Validates synthesis result reason

**Technical Details**:

- Creates new synthesizer instance per request
- Uses Azure's `speakTextAsync` API
- Returns audio data as a Node.js Readable stream containing a single Buffer
- Audio format is determined by Azure SDK defaults (typically 16kHz, 16-bit, mono PCM WAV)

### 3. listen(audioStream)

**Purpose**: Transcribes audio to text (STT)

**Parameters**:

- `audioStream: NodeJS.ReadableStream` - Audio input in WAV format

**Returns**: `Promise<string>` - Recognized text

**Data Flow**:

```
Audio Stream Input
    ↓
[Buffer Accumulation] (read all chunks into memory)
    ↓
[Push Stream Creation] (Azure AudioInputStream)
    ↓
[Audio Config Setup] (fromStreamInput)
    ↓
[Recognizer Creation] (new SpeechRecognizer)
    ↓
[Chunk Writing] (write audio in 4096-byte chunks)
    ↓
[Recognition Execution] (recognizeOnceAsync)
    ↓
[Result Validation] (check ResultReason.RecognizedSpeech)
    ↓
Output Text
```

**Error Handling**:

- Throws if `listeningConfig` is not initialized
- Validates recognition result reason
- Provides detailed error messages with reason codes
- Properly closes recognizer in finally block

**Technical Details**:

- Accumulates entire audio stream into memory before processing
- Writes audio data in 4096-byte chunks to Azure's push stream
- Uses Azure's `recognizeOnceAsync` API (single utterance recognition)
- Audio must be in WAV format compatible with Azure's requirements

### 4. getListener()

**Purpose**: Checks if listening capabilities are enabled

**Returns**: `Promise<{ enabled: boolean }>`

**Implementation**: Always returns `{ enabled: true }`

**Note**: This is a simple capability check method, likely used by the Mastra framework to determine if STT is available

## Voice Definitions

### AZURE_VOICES Array

Located in `voices.ts`, this file contains a const array of 200+ voice IDs representing:

- **Languages**: 50+ languages including Arabic, English, German, Spanish, Chinese, etc.
- **Regions**: Multiple regional variants (e.g., en-US, en-GB, en-AU)
- **Voice Types**:
  - Standard Neural voices
  - Multilingual voices (suffixed with `Multilingual`)
  - HD voices (suffixed with `:DragonHDLatestNeural`)
  - AI-generated voices (e.g., `AIGenerate1Neural`, `AIGenerate2Neural`)
  - Turbo multilingual voices (e.g., `AlloyTurboMultilingualNeural`)

### Voice ID Format

Standard format: `{language}-{region}-{name}Neural`
Examples:

- `en-US-AriaNeural`
- `de-DE-SeraphinaMultilingualNeural`
- `en-US-Andrew:DragonHDLatestNeural`

### VoiceId Type

Exported as a TypeScript const assertion type:

```typescript
export type VoiceId = (typeof AZURE_VOICES)[number];
```

This provides strict type safety for voice selection.

## Integration with Mastra Framework

### Base Class Contract

The `AzureVoice` class fulfills the `MastraVoice` abstract interface:

1. **Constructor**: Calls `super()` with standardized configuration
2. **speak()**: Implements text-to-speech
3. **listen()**: Implements speech-to-text
4. **getSpeakers()**: Returns available voices
5. **getListener()**: Returns listener capability status

### Configuration Propagation

The constructor passes configuration to the base `MastraVoice` class:

- `speechModel.name` and `speechModel.apiKey`
- `listeningModel.name` and `listeningModel.apiKey`
- `speaker` (default voice)

This allows the Mastra framework to track which models are configured.

## Error Handling Strategy

### Configuration Errors

- Missing API key → throws immediately in constructor
- Missing region → throws immediately in constructor

### Runtime Errors

- Unconfigured models → throws on method call
- Empty input text → throws validation error
- Stream reading errors → wrapped and re-thrown
- Synthesis/recognition failures → detailed error messages with Azure reason codes
- Timeout protection → 5-second timeout on synthesis

### Resource Cleanup

- Uses try/catch/finally pattern
- Closes synthesizer and recognizer instances
- Prevents resource leaks

## Dependencies

### External Dependencies

1. **microsoft-cognitiveservices-speech-sdk** (v1.45.0)
   - Core Azure Speech Services SDK
   - Provides SpeechConfig, SpeechSynthesizer, SpeechRecognizer
   - Handles audio format conversion and streaming

2. **Node.js stream API**
   - Uses `Readable` from 'stream'
   - Handles streaming input/output

### Peer Dependencies

- **@mastra/core** (>=1.0.0-0 <2.0.0-0)
  - Provides base `MastraVoice` class
  - Defines voice provider interface

## Build and Distribution

### Build Configuration

- **Bundler**: tsup (configured in `tsup.config.ts`)
- **Output formats**: ESM (`.js`) and CommonJS (`.cjs`)
- **TypeScript**: Generates `.d.ts` type definitions
- **Source maps**: Generated for all outputs

### Package Exports

```json
{
  ".": {
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  }
}
```

Supports both ESM and CommonJS consumers.

## Testing Strategy

The test suite (`index.test.ts`) covers:

1. **Initialization Tests**
   - Default parameter initialization
   - Environment variable fallback

2. **getSpeakers() Tests**
   - Voice list structure validation
   - Metadata completeness

3. **speak() Tests**
   - Basic text synthesis
   - Custom voice selection
   - Stream input handling
   - Parameter variations
   - Error cases (empty text, missing API key)

4. **listen() Tests**
   - Audio file transcription
   - Stream transcription
   - Round-trip (speak → listen) verification

5. **Error Handling Tests**
   - Empty input validation
   - Missing credentials
   - Configuration errors

### Test Utilities

- Creates test output directory for audio files
- Writes synthesized audio to files for inspection
- Uses real Azure API (requires credentials)

## Performance Considerations

### Memory Usage

- **listen()** accumulates entire audio stream in memory
- Large audio files may cause memory pressure
- Consider streaming alternatives for production use

### Timeout Protection

- **speak()** implements 5-second timeout
- Prevents hanging on Azure API failures
- May need adjustment for longer texts

### Resource Management

- Creates new synthesizer/recognizer instances per request
- No instance pooling or reuse
- Proper cleanup in finally blocks

## Security Considerations

1. **Credential Management**
   - API keys via environment variables (recommended)
   - Supports direct configuration (use with caution)
   - No credential validation before API calls

2. **Input Validation**
   - Text input validated for emptiness
   - No SSML injection protection
   - Stream inputs trusted

3. **Error Messages**
   - May expose internal Azure error details
   - Consider sanitizing errors in production

## Future Enhancement Opportunities

1. **Streaming Improvements**
   - Stream audio chunks incrementally in listen()
   - Reduce memory footprint for large files

2. **SSML Support**
   - Add explicit SSML input handling
   - Validate and sanitize SSML

3. **Configuration Caching**
   - Reuse synthesizer/recognizer instances
   - Connection pooling

4. **Advanced Features**
   - Voice customization parameters
   - Audio format selection
   - Real-time streaming synthesis
   - Continuous recognition mode

5. **Observability**
   - Add metrics/telemetry
   - Performance monitoring
   - Usage tracking

## Usage Examples

### Basic TTS

```typescript
const voice = new AzureVoice({
  speechModel: { apiKey: 'key', region: 'eastus' },
});
const audioStream = await voice.speak('Hello World');
```

### Basic STT

```typescript
const voice = new AzureVoice({
  listeningModel: { apiKey: 'key', region: 'eastus' },
});
const text = await voice.listen(audioStream);
```

### Full Bidirectional

```typescript
const voice = new AzureVoice({
  speechModel: { apiKey: 'key', region: 'eastus' },
  listeningModel: { apiKey: 'key', region: 'eastus' },
  speaker: 'en-US-JennyNeural',
});

const audio = await voice.speak('Test message');
const transcription = await voice.listen(audio);
```

### Custom Voice Selection

```typescript
const audio = await voice.speak('Bonjour', {
  speaker: 'fr-FR-DeniseNeural',
});
```

## Summary

The `@mastra/voice-azure` package provides a clean, TypeScript-native wrapper around Azure's Cognitive Services Speech SDK. It implements the Mastra voice provider interface with proper error handling, type safety, and resource management. The architecture prioritizes simplicity and correctness over advanced features, making it suitable for basic voice synthesis and recognition tasks within the Mastra ecosystem.

Key architectural strengths:

- Clean separation of TTS and STT configuration
- Type-safe voice selection with 200+ options
- Proper resource cleanup
- Error handling with detailed messages
- Framework integration through base class inheritance

Key areas for improvement:

- Memory efficiency in STT processing
- Advanced streaming capabilities
- Configuration caching and reuse
- Enhanced observability
