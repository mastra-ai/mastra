---
'create-factory': patch
---

Fixed the Factory template sync to replace linked dependencies with exact published versions from the release channel matching each source package. Generated templates now configure npm to install compatible prerelease package sets.
