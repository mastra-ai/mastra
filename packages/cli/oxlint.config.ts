import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: [
    'src/public/**',
    'src/commands/api/route-metadata.generated.ts',
    'src/commands/api/factory-route-metadata.generated.ts',
  ],
});
