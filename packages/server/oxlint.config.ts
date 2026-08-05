import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: ['./*.d.ts', '**/*.d.ts', '!src/**/*.d.ts'],
});
