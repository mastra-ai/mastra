# @mastra/voice-playai

## 0.1.0-alpha.2

### Patch Changes

- 41d0166: deprecate @mastra/speech-playai for @mastra/voice-playai
- Updated dependencies [7fceae1]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0

## 0.1.0 (2024-XX-XX)

This package replaces the deprecated @mastra/speech-playai package. All functionality has been migrated to this new package with a more consistent naming scheme.

### Changes from @mastra/speech-playai

- Package renamed from @mastra/speech-playai to @mastra/voice-playai
- API changes:
  - `PlayAITTS` class renamed to `PlayAIVoice`
  - `generate()` and `stream()` methods combined into `speak()`
  - `voices()` method renamed to `getSpeakers()`
  - Constructor configuration simplified
  - Added support for text stream input
  - Default speaker configuration added
- All core functionality remains the same
- Import paths should be updated from '@mastra/speech-playai' to '@mastra/voice-playai'

### Key Features Preserved

- High-quality voice synthesis
- Multiple voice options with rich metadata
- Streaming support
- Natural and expressive speech output

For a complete history of changes prior to the rename, please see the changelog of the original package.
