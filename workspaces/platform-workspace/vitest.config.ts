import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Same as tsdown's `loader: { '.py': 'text' }`: a Python source imports as its text.
  plugins: [
    {
      name: 'python-text',
      transform(code, id) {
        if (id.endsWith('.py')) return { code: `export default ${JSON.stringify(code)};`, map: null };
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
  },
});
