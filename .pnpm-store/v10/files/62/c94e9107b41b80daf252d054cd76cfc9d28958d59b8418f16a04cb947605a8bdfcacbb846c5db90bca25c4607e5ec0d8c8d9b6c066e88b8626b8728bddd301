# @changesets/parse

[![npm package](https://img.shields.io/npm/v/@changesets/parse)](https://npmjs.com/package/@changesets/parse)
[![View changelog](https://img.shields.io/badge/Explore%20Changelog-brightgreen)](./CHANGELOG.md)

Parses a changeset from its written format to a data object.

```js
import parse from "@changesets/parse";

const changeset = `---
"@changesets/something": minor
"@changesets/something-else": patch
---

A description of a minor change`;

const parsedChangeset = parse(changeset);
```

For example, it can convert:

```md
---
"@changesets/something": minor
"@changesets/something-else": patch
---

A description of a minor change
```

to

```json
{
  "summary": "A description of a minor change",
  "releases": [
    { "name": "@changesets/something", "type": "minor" },
    { "name": "@changesets/something-else", "type": "patch" }
  ]
}
```

Note that this is not quite a complete Changeset for most tools as it lacks an `id`.

For written changesets, the id is normally given as the file name, which parse is not aware of.
