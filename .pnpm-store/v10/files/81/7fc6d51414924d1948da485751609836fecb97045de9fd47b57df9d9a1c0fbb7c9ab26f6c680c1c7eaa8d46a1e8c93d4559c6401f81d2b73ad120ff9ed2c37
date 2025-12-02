# changesets-changelog-github-local

A changelog generator for [changesets](https://github.com/changesets/changesets) that adds GitHub repository links to commits and pull requests, improving the readability of your changelogs. This package works without network requests to the GitHub API (instead it uses `git`).

![NPM Version](https://img.shields.io/npm/v/changesets-changelog-github-local) ![NPM Downloads](https://img.shields.io/npm/dm/changesets-changelog-github-local)

## Installation

```bash
# npm
npm install --save-dev changesets-changelog-github-local
```

```bash
# yarn
yarn add --dev changesets-changelog-github-local
```

```bash
# pnpm
pnpm add --save-dev changesets-changelog-github-local
```

## Usage

Add the changelog generator to your `.changeset/config.json` file:

```json
{
  "changelog": ["changesets-changelog-github-local", { "repo": "owner/repo" }]
}
```

Replace `"owner/repo"` with your GitHub repository identifier (for example, `"LekoArts/changesets-changelog-github-local"`).

> [!IMPORTANT]
> **Best practice:** Use [squash merging](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges#squash-and-merge-your-commits) for your pull requests. This ensures PR numbers are consistently included in commit messages, which helps this changelog generator create better links to your pull requests.
> Alternatively you need to make sure that PR numbers (in the format `(#123)`) are at the end of the first line of your commit message.

### Features

- Links to commits and pull requests in your changelogs
- Works without requiring GitHub API requests
- Extracts PR numbers from commit messages
- Shortens commit hashes for better readability

### Example Output

```markdown
## 1.2.0

### Minor Changes

- Added new feature ([#123](https://github.com/owner/repo/pull/123))

### Patch Changes

- Fixed bug in API handling ([`a1b2c3d`](https://github.com/owner/repo/commit/a1b2c3d4e5f6...))
- Updated dependencies [[`e7f8g9h`](https://github.com/owner/repo/commit/e7f8g9h...)]:
  - dependency-package@2.0.0
```

## Development

- Install dependencies:

  ```bash
  pnpm install
  ```

- Run the unit tests:

  ```bash
  pnpm test
  ```

- Build the library:

  ```bash
  pnpm build
  ```

## License

MIT

## Acknowledgements

- [`changelog-github`](https://github.com/changesets/changesets/tree/main/packages/changelog-github)
- [`changelog-github-compact`](https://github.com/svitejs/changesets-changelog-github-compact)
