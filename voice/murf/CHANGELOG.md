# @mastra/voice-murf

## 0.1.0 (2024-XX-XX)

This package replaces the deprecated @mastra/speech-murf package. All functionality has been migrated to this new package with a more consistent naming scheme.

### Changes from @mastra/speech-murf

- Package renamed from @mastra/speech-murf to @mastra/voice-murf
- API changes:
  - `MurfTTS` class renamed to `MurfVoice`
  - `generate()` and `stream()` methods combined into `speak()`
  - `voices()` method renamed to `getSpeakers()`
  - Constructor configuration simplified
  - Added support for text stream input
  - Default speaker configuration added
- All core functionality remains the same
- Import paths should be updated from '@mastra/speech-murf' to '@mastra/voice-murf'

### Key Features Preserved

- High-quality voice synthesis
- Multiple voice options with rich metadata
- Streaming support
- Natural and expressive speech output
- Voice customization options including:
  - Style control
  - Rate adjustment
  - Pitch modification
  - Sample rate selection
  - Audio format options
  - Channel type selection
  - Pronunciation dictionary support

For a complete history of changes prior to the rename, please see the changelog of the original package.
