Claude follow these steps please:

1. update all package.json where a require + types is present and change d.cts to .ts

OLD:

```
"exports": {
  ".": {
    "import": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "require": {
      "types": "./dist/index.d.cts",
      "default": "./dist/index.cjs"
    }
  },
}
```

NEW:

```
"exports": {
  ".": {
    "import": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "require": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.cjs"
    }
  },
}
```

2. add @internal/types-builder to any package that uses tsup.
3. in tsup.config.ts, update the onSuccess callback with

```
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
```

Don't forget to import the function from @internal/types. Remove all other code inside the onSuccess function.

If you have any questions please ask.
