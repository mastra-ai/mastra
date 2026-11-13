---
'create-factory': patch
---

`create-factory` can now set up the Factory in the current directory. When you run it without a project name in an empty directory, the name prompt defaults to that directory: press Enter to use it, or type a name to create a new directory. An existing empty directory can also be passed as the project name.

```bash
mkdir my-factory && cd my-factory
npx create-factory@latest
```
