---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge `createNode` and `updateNode` now reject empty and whitespace-only node names with `Knowledge node names must not be blank.`, and nothing is written. Node names are how `getNodeByName` and `[[wikilinks]]` find a node, and a blank name could never be found that way. Names containing other characters are accepted as before.
