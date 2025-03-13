import { defineConfig } from 'vitest/config';
import * as dotenv from 'dotenv';

dotenv.config(); // ✅ This loads .env into process.env
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
