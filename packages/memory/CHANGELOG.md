# @mastra/memory

## 0.1.0-alpha.89

### Patch Changes

- Updated dependencies [66a5392]
  - @mastra/core@0.2.0-alpha.107

## 0.1.0-alpha.88

### Patch Changes

- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
  - @mastra/core@0.2.0-alpha.106

## 0.1.0-alpha.87

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105

## 0.1.0-alpha.86

### Patch Changes

- b97ca96: Tracing into default storage
- cf6d825: Fixed a bug where 0 values in memory configs were falling back to default val. Removed a noisy log. Removed a deprecated option
- 10870bc: Added a default vector db (libsql) and embedder (fastembed) so that new Memory() can be initialized with zero config
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104

## 0.1.0-alpha.85

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103

## 0.1.0-alpha.84

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102

## 0.1.0-alpha.83

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101

## 0.1.0-alpha.82

### Patch Changes

- Updated dependencies [9d1796d]
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.81

### Patch Changes

- Updated dependencies [7d83b92]
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.80

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98

## 0.1.0-alpha.79

### Patch Changes

- a870123: Added local embedder class that uses fastembed-js, a Typescript/NodeJS implementation of @Qdrant/fastembed
- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
  - @mastra/core@0.2.0-alpha.97

## 0.1.0-alpha.78

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96

## 0.1.0-alpha.77

### Patch Changes

- Updated dependencies [9fb59d6]
  - @mastra/core@0.2.0-alpha.95

## 0.1.0-alpha.76

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94

## 0.1.0-alpha.75

### Patch Changes

- Updated dependencies [5285356]
  - @mastra/core@0.2.0-alpha.93

## 0.1.0-alpha.74

### Patch Changes

- Updated dependencies [4d4f6b6]
  - @mastra/core@0.2.0-alpha.92

## 0.1.0-alpha.73

### Minor Changes

- d7d465a: Breaking change for Memory: embeddings: {} has been replaced with embedder: new OpenAIEmbedder() (or whichever embedder you want - check the docs)

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91

## 0.1.0-alpha.72

### Patch Changes

- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90

## 0.1.0-alpha.71

### Minor Changes

- 27275c9: Added new short term "working" memory for agents. Also added a "maskStreamTags" helper to assist in hiding working memory xml blocks in streamed responses

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89

## 0.1.0-alpha.70

### Patch Changes

- Updated dependencies [ccbc581]
  - @mastra/core@0.2.0-alpha.88

## 0.1.0-alpha.69

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87

## 0.1.0-alpha.68

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- 67637ba: Fixed storage bugs related to the new Memory API
- Updated dependencies [6fa4bd2]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86

## 0.1.0-alpha.67

### Patch Changes

- e9d1b47: Rename Memory options historySearch to semanticRecall, rename embeddingOptions to embedding
- Updated dependencies [e9d1b47]
  - @mastra/core@0.2.0-alpha.85

## 0.1.0-alpha.66

### Minor Changes

- cb290ee: Reworked the Memory public API to have more intuitive and simple property names

### Patch Changes

- Updated dependencies [2f17a5f]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84

## 0.1.0-alpha.65

### Minor Changes

- 30322ce: Added new Memory API for managed agent memory via MastraStorage and MastraVector classes

### Patch Changes

- c35aa18: bug: not all models support multiple system messages
- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/core@0.2.0-alpha.83

## 0.0.2-alpha.64

### Patch Changes

- Updated dependencies [73d112c]
  - @mastra/core@0.1.27-alpha.82

## 0.0.2-alpha.63

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81

## 0.0.2-alpha.62

### Patch Changes

- 7f5b1b2: @mastra/memory tsup bundling

## 0.0.2-alpha.61

### Patch Changes

- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80

## 0.0.2-alpha.60

### Patch Changes

- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79

## 0.0.2-alpha.59

### Patch Changes

- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/core@0.1.27-alpha.78

## 0.0.2-alpha.58

### Patch Changes

- Updated dependencies [8105fae]
  - @mastra/core@0.1.27-alpha.77

## 0.0.2-alpha.57

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/core@0.1.27-alpha.76

## 0.0.2-alpha.56

### Patch Changes

- Updated dependencies [23dcb23]
  - @mastra/core@0.1.27-alpha.75

## 0.0.2-alpha.55

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74

## 0.0.2-alpha.54

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73

## 0.0.2-alpha.53

### Patch Changes

- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72

## 0.0.2-alpha.52

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/core@0.1.27-alpha.71

## 0.0.2-alpha.51

### Patch Changes

- bdaf834: publish packages

## 0.0.2-alpha.50

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70

## 0.0.2-alpha.49

### Patch Changes

- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/core@0.1.27-alpha.69

## 0.0.2-alpha.48

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68

## 0.0.2-alpha.47

### Patch Changes

- Updated dependencies [c8ff2f5]
  - @mastra/core@0.1.27-alpha.67

## 0.0.2-alpha.46

### Patch Changes

- Updated dependencies [14064f2]
  - @mastra/core@0.1.27-alpha.66

## 0.0.2-alpha.45

### Patch Changes

- Updated dependencies [e66643a]
  - @mastra/core@0.1.27-alpha.65

## 0.0.2-alpha.44

### Patch Changes

- Updated dependencies [f368477]
- Updated dependencies [d5ec619]
  - @mastra/core@0.1.27-alpha.64

## 0.0.2-alpha.43

### Patch Changes

- Updated dependencies [e097800]
  - @mastra/core@0.1.27-alpha.63

## 0.0.2-alpha.42

### Patch Changes

- Updated dependencies [93a3719]
  - @mastra/core@0.1.27-alpha.62

## 0.0.2-alpha.41

### Patch Changes

- Updated dependencies [dc90663]
  - @mastra/core@0.1.27-alpha.61

## 0.0.2-alpha.40

### Patch Changes

- Updated dependencies [3967e69]
  - @mastra/core@0.1.27-alpha.60

## 0.0.2-alpha.39

### Patch Changes

- Updated dependencies [b524c22]
  - @mastra/core@0.1.27-alpha.59

## 0.0.2-alpha.38

### Patch Changes

- Updated dependencies [1874f40]
- Updated dependencies [4b1ce2c]
  - @mastra/core@0.1.27-alpha.58

## 0.0.2-alpha.37

### Patch Changes

- Updated dependencies [fd494a3]
  - @mastra/core@0.1.27-alpha.57

## 0.0.2-alpha.36

### Patch Changes

- Updated dependencies [9f3ab05]
  - @mastra/core@0.1.27-alpha.56

## 0.0.2-alpha.35

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 0b74006: Workflow updates
- Updated dependencies [592e3cf]
- Updated dependencies [837a288]
- Updated dependencies [0b74006]
  - @mastra/core@0.1.27-alpha.55

## 0.0.2-alpha.34

### Patch Changes

- Updated dependencies [d2cd535]
  - @mastra/core@0.1.27-alpha.54

## 0.0.2-alpha.33

### Patch Changes

- Updated dependencies [8e7814f]
  - @mastra/core@0.1.27-alpha.53

## 0.0.2-alpha.32

### Patch Changes

- Updated dependencies [eedb829]
  - @mastra/core@0.1.27-alpha.52

## 0.0.2-alpha.31

### Patch Changes

- Updated dependencies [a7b016d]
- Updated dependencies [da2e8d3]
- Updated dependencies [538a136]
  - @mastra/core@0.1.27-alpha.51

## 0.0.2-alpha.30

### Patch Changes

- Updated dependencies [401a4d9]
  - @mastra/core@0.1.27-alpha.50

## 0.0.2-alpha.29

### Patch Changes

- Updated dependencies [79acad0]
- Updated dependencies [f5dfa20]
  - @mastra/core@0.1.27-alpha.49

## 0.0.2-alpha.28

### Patch Changes

- Updated dependencies [b726bf5]
  - @mastra/core@0.1.27-alpha.48

## 0.0.2-alpha.27

### Patch Changes

- Updated dependencies [f6ba259]
  - @mastra/core@0.1.27-alpha.47

## 0.0.2-alpha.26

### Patch Changes

- 8ae2bbc: Dane publishing
- 0bd142c: Fixes learned from docs
- ee4de15: Dane fixes
- Updated dependencies [8ae2bbc]
- Updated dependencies [0bd142c]
- Updated dependencies [ee4de15]
  - @mastra/core@0.1.27-alpha.46

## 0.0.2-alpha.25

### Patch Changes

- 3220d26: Fix lastStep error in agent stream

## 0.0.2-alpha.24

### Patch Changes

- 002d6d8: add memory to playground agent
- Updated dependencies [e608d8c]
- Updated dependencies [002d6d8]
  - @mastra/core@0.1.27-alpha.45

## 0.0.2-alpha.23

### Patch Changes

- Updated dependencies [2fa7f53]
  - @mastra/core@0.1.27-alpha.44

## 0.0.2-alpha.22

### Patch Changes

- Updated dependencies [2e099d2]
- Updated dependencies [d6d8159]
  - @mastra/core@0.1.27-alpha.43

## 0.0.2-alpha.21

### Patch Changes

- Updated dependencies [4a54c82]
  - @mastra/core@0.1.27-alpha.42

## 0.0.2-alpha.20

### Patch Changes

- Updated dependencies [5cdfb88]
  - @mastra/core@0.1.27-alpha.41

## 0.0.2-alpha.19

### Patch Changes

- Updated dependencies [9029796]
  - @mastra/core@0.1.27-alpha.40

## 0.0.2-alpha.18

### Patch Changes

- Updated dependencies [2b01511]
  - @mastra/core@0.1.27-alpha.39

## 0.0.2-alpha.17

### Patch Changes

- Updated dependencies [f031a1f]
  - @mastra/core@0.1.27-alpha.38

## 0.0.2-alpha.16

### Patch Changes

- b5393f1: New example: Dane and many fixes to make it work
- Updated dependencies [c872875]
- Updated dependencies [f6da688]
- Updated dependencies [b5393f1]
  - @mastra/core@0.1.27-alpha.37

## 0.0.2-alpha.15

### Patch Changes

- b898fad: Fix get context window in memory
- Updated dependencies [f537e33]
- Updated dependencies [bc40916]
- Updated dependencies [f7d1131]
- Updated dependencies [75bf3f0]
- Updated dependencies [3c4488b]
- Updated dependencies [d38f7a6]
  - @mastra/core@0.1.27-alpha.36

## 0.0.2-alpha.14

### Patch Changes

- 033eda6: More fixes for refactor
- Updated dependencies [033eda6]
  - @mastra/core@0.1.27-alpha.35

## 0.0.2-alpha.13

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- Updated dependencies [837a288]
- Updated dependencies [5811de6]
  - @mastra/core@0.1.27-alpha.34

## 0.0.2-alpha.12

### Patch Changes

- Updated dependencies [e1dd94a]
  - @mastra/core@0.1.27-alpha.33

## 0.0.2-alpha.11

### Patch Changes

- Updated dependencies [2712098]
  - @mastra/core@0.1.27-alpha.32

## 0.0.2-alpha.10

### Patch Changes

- Updated dependencies [c2dd6b5]
  - @mastra/core@0.1.27-alpha.31

## 0.0.2-alpha.9

### Patch Changes

- Updated dependencies [963c15a]
  - @mastra/core@0.1.27-alpha.30

## 0.0.2-alpha.8

### Patch Changes

- Updated dependencies [7d87a15]
  - @mastra/core@0.1.27-alpha.29

## 0.0.2-alpha.7

### Patch Changes

- Updated dependencies [1ebd071]
  - @mastra/core@0.1.27-alpha.28

## 0.0.2-alpha.6

### Patch Changes

- Updated dependencies [cd02c56]
  - @mastra/core@0.1.27-alpha.27

## 0.0.2-alpha.5

### Patch Changes

- Updated dependencies [d5e12de]
  - @mastra/core@0.1.27-alpha.26

## 0.0.2-alpha.4

### Patch Changes

- 01502b0: fix thread title containing unnecessary text and removed unnecessary logs in memory
- Updated dependencies [01502b0]
  - @mastra/core@0.1.27-alpha.25

## 0.0.2-alpha.3

### Patch Changes

- 836f4e3: Fixed some issues with memory, added Upstash as a memory provider. Silenced dev logs in core
- Updated dependencies [836f4e3]
  - @mastra/core@0.1.27-alpha.24

## 0.0.2-alpha.2

### Patch Changes

- Updated dependencies [0b826f6]
  - @mastra/core@0.1.27-alpha.23

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies [7a19083]
  - @mastra/core@0.1.27-alpha.22

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies [5ee2e78]
  - @mastra/core@0.1.27-alpha.21
