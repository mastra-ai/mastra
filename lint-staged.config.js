import path from 'node:path';

// Fallback for staged files with no nearer lint-staged config: root files, scripts/, .github/, and so on.
// Skip the trees `pnpm lint:format` skips: docs/ (which has its own config), examples/, explorations/ and
// observability/_examples/.
const excludedDirs = ['docs/', 'examples/', 'explorations/', 'observability/_examples/'];

export default {
  '*.{js,jsx,cjs,mjs,ts,tsx,md,mdx,json,jsonc,json5,graphql,gql,css,scss,less,yml,yaml,toml}': files => {
    const included = files.filter(file => {
      const relative = path.relative(import.meta.dirname, file).replaceAll(path.sep, '/');
      return !excludedDirs.some(dir => relative.startsWith(dir));
    });
    return included.length
      ? [`oxfmt --no-error-on-unmatched-pattern ${included.map(file => JSON.stringify(file)).join(' ')}`]
      : [];
  },
};
