import path from 'node:path';

// Fallback for staged files with no nearer lint-staged config: root files, scripts/, .github/, and so on.
// Skip trees the root oxfmt setup does not own: docs/ has its own config, examples/, explorations/ and
// observability/_examples/ are excluded from `pnpm lint:format`, and templates/ are standalone projects.
const excludedDirs = ['docs/', 'examples/', 'explorations/', 'observability/_examples/', 'templates/'];

export default {
  '*.{js,jsx,cjs,mjs,ts,tsx,md,json,jsonc,json5,graphql,gql,css,scss,less,yml,yaml,toml}': files => {
    const included = files.filter(file => {
      const relative = path.relative(import.meta.dirname, file).replaceAll(path.sep, '/');
      return !excludedDirs.some(dir => relative.startsWith(dir));
    });
    return included.length
      ? [`oxfmt --no-error-on-unmatched-pattern ${included.map(file => JSON.stringify(file)).join(' ')}`]
      : [];
  },
};
