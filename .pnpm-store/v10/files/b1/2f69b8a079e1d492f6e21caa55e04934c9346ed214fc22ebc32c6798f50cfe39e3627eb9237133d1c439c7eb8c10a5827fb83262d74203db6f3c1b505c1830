# plugin-request-log.js

> Log all requests and request errors

[![@latest](https://img.shields.io/npm/v/@octokit/plugin-request-log.svg)](https://www.npmjs.com/package/@octokit/plugin-request-log)
[![Build Status](https://github.com/octokit/plugin-request-log.js/workflows/Test/badge.svg)](https://github.com/octokit/plugin-request-log.js/actions?workflow=Test)

## Usage

<table>
<tbody valign=top align=left>
<tr><th>
Browsers
</th><td width=100%>

Load `@octokit/plugin-request-log` and [`@octokit/core`](https://github.com/octokit/core.js) (or core-compatible module) directly from [esm.sh](https://esm.sh)

```html
<script type="module">
  import { Octokit } from "https://esm.sh/@octokit/core";
  import { requestLog } from "https://esm.sh/@octokit/plugin-request-log";
</script>
```

</td></tr>
<tr><th>
Node
</th><td>

Install with `npm install @octokit/core @octokit/plugin-request-log`. Optionally replace `@octokit/core` with a core-compatible module

```js
import { Octokit } from "@octokit/core";
import { requestLog } from "@octokit/plugin-request-log";
```

</td></tr>
</tbody>
</table>

> [!IMPORTANT]
> As we use [conditional exports](https://nodejs.org/api/packages.html#conditional-exports), you will need to adapt your `tsconfig.json` by setting `"moduleResolution": "node16", "module": "node16"`.
>
> See the TypeScript docs on [package.json "exports"](https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports).<br>
> See this [helpful guide on transitioning to ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) from [@sindresorhus](https://github.com/sindresorhus)

```js
const MyOctokit = Octokit.plugin(requestLog);
const octokit = new MyOctokit({ auth: "secret123" });

octokit.request("GET /");
// logs "GET / - 200 in 123ms

octokit.request("GET /oops");
// logs "GET / - 404 in 123ms
```

In order to log all request options, the `log.debug` option needs to be set. We recommend the [console-log-level](https://github.com/watson/console-log-level) package for a configurable log level

```js
import consoleLogLevel from "console-log-level";
const octokit = new MyOctokit({
  log: consoleLogLevel({
    auth: "secret123",
    level: "info",
  }),
});
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE)
