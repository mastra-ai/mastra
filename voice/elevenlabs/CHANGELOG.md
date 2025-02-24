# @mastra/voice-elevenlabs

## 0.1.0 (2024-XX-XX)

This package replaces the deprecated @mastra/speech-elevenlabs package. All functionality has been migrated to this new package with a more consistent naming scheme.

### Changes from @mastra/speech-elevenlabs

- Package renamed from @mastra/speech-elevenlabs to @mastra/voice-elevenlabs
- API changes:
  - `ElevenLabsTTS` class renamed to `ElevenLabsVoice`
  - `generate()` method renamed to `speak()`
  - `voices()` method renamed to `getSpeakers()`
  - Constructor configuration simplified
- All core functionality remains the same
- Import paths should be updated from '@mastra/speech-elevenlabs' to '@mastra/voice-elevenlabs'

For a complete history of changes prior to the rename, please see the changelog of the original package.
