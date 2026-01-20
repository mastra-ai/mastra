---
'@mastra/core': patch
---

Fix tool input validation destroying non-plain objects

The `convertUndefinedToNull` function in tool input validation was treating all objects as plain objects and recursively processing them. For objects like `Date`, `Map`, `URL`, and class instances, this resulted in empty objects `{}` because they have no enumerable own properties.

This fix changes the approach to only recurse into plain objects (objects with `Object.prototype` or `null` prototype). All other objects (Date, Map, Set, URL, RegExp, Error, custom class instances, etc.) are now preserved as-is.

Fixes #11502
