# @mastra/voice-murf

## 0.1.1-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2

## 0.1.1-alpha.1

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0

## 0.1.0

### Patch Changes

- 5b1af96: deprecate @mastra/speech-murf for @mastra/voice-murf
- Updated dependencies [7fceae1]
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2

## 0.1.0-alpha.4

### Patch Changes

- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2

## 0.1.0-alpha.3

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1

## 0.1.0-alpha.2

### Patch Changes

- 5b1af96: deprecate @mastra/speech-murf for @mastra/voice-murf

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
