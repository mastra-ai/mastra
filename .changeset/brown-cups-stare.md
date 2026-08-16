---
'@mastra/observability': patch
---

Fixed the `__truncated` marker on span data so it counts only the fields dropped by the object-key limit. Fields removed during span serialization were counted as truncated, so traces reported more omitted keys than were really dropped — an object of 52 keys holding one internal field reported `2 more keys omitted` instead of `1`. Values of keys past the limit are also no longer read, so getters do not run for data that is being dropped.
