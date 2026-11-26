import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

// Same BDD structure enforced for playground tests: outer describe = the unit,
// inner describe('when …') = one precondition, each it() = one outcome.
const BDD_MESSAGE =
  "BDD: every it()/test() must live inside a describe('when …') precondition block. " +
  "Outer describe = the unit, inner describe('when …') = ONE precondition, each it = ONE outcome.";

// Tests moved from playground-ui predate this rule (it only covered Playwright
// specs there). They are frozen here; new hook tests must follow the BDD layout.
export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['.storybook/**'],
  overrides: [
    {
      files: ['src/hooks/**/*.{test,spec}.{ts,tsx}'],
      rules: {
        'mastra/test-needs-when-describe': [
          'error',
          { style: 'vitest', modifiers: ['skip', 'only', 'todo', 'fails', 'each'], message: BDD_MESSAGE },
        ],
      },
    },
  ],
});
