# rest.js

> GitHub REST API client for JavaScript

[![@latest](https://img.shields.io/npm/v/@octokit/rest.svg)](https://www.npmjs.com/package/@octokit/rest)
[![Build Status](https://github.com/octokit/rest.js/workflows/Test/badge.svg)](https://github.com/octokit/rest.js/actions?query=workflow%3ATest+branch%3Amain)

## Usage

<table>
<tbody valign=top align=left>
<tr><th>
Browsers
</th><td width=100%>
Load <code>@octokit/rest</code> directly from <a href="https://esm.sh">esm.sh</a>

```html
<script type="module">
  import { Octokit } from "https://esm.sh/@octokit/rest";
</script>
```

</td></tr>
<tr><th>
Node
</th><td>

Install with <code>npm install @octokit/rest</code>

```js
import { Octokit } from "@octokit/rest";
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
const octokit = new Octokit();

// Compare: https://docs.github.com/en/rest/reference/repos/#list-organization-repositories
octokit.rest.repos
  .listForOrg({
    org: "octokit",
    type: "public",
  })
  .then(({ data }) => {
    // handle data
  });
```

See https://octokit.github.io/rest.js for full documentation.

> [!IMPORTANT]
> As we use [conditional exports](https://nodejs.org/api/packages.html#conditional-exports), you will need to adapt your `tsconfig.json` by setting `"moduleResolution": "node16", "module": "node16"`.
>
> See the TypeScript docs on [package.json "exports"](https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports).<br>
> See this [helpful guide on transitioning to ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) from [@sindresorhus](https://github.com/sindresorhus)

## Contributing

We would love you to contribute to `@octokit/rest`, pull requests are very welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## Credits

`@octokit/rest` was originally created as [`node-github`](https://www.npmjs.com/package/github) in 2012 by Mike de Boer from Cloud9 IDE, Inc. [The original commit](https://github.blog/2020-04-09-from-48k-lines-of-code-to-10-the-story-of-githubs-javascript-sdk/) is from 2010 which predates the npm registry.

It was adopted and renamed by GitHub in 2017. Learn more about its origin on GitHub's blog: [From 48k lines of code to 10—the story of GitHub’s JavaScript SDK](https://github.blog/2020-04-09-from-48k-lines-of-code-to-10-the-story-of-githubs-javascript-sdk/)

## LICENSE

[MIT](LICENSE)
