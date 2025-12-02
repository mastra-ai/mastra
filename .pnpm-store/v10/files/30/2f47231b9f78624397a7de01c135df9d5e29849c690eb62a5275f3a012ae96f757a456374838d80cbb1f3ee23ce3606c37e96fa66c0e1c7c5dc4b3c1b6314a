# typescript-paths

[npm:latest]: https://www.npmjs.com/package/typescript-paths/v/latest
[npm:latest:badge]: https://img.shields.io/npm/v/typescript-paths/latest?style=flat-square

[![Latest Version][npm:latest:badge]][npm:latest]

Resolving tsconfig paths in runtime

```sh
npm install typescript-paths
```

```js
const { register } = require("typescript-paths")
register()
```

Example tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./*"]
    }
  }
}
```

Then you can import alias instead of annoying path

```js
// const App = require("../../../../App")
const App = require("~/App")
```

## Options

### tsConfigPath _(string | string[])_

Specify the path where your TypeScript configuration file.

If not set:

- use Environment variable **TS_NODE_PROJECT**
- or search tsconfig.json in current working directory.

### logLevel _("none" | "error" | "warn" | "info" | "debug" | "trace") (default: "info")_

Set the logging level on the plugin.

### fallback _(function (string): string | undefined)_

The handler to handle unusual module name.

### color _(boolean) (default: true)_

Colorful ouput.

### respectCoreModule _(boolean) (default: true)_

## reference

- https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping
- https://github.com/microsoft/TypeScript/issues/5039
