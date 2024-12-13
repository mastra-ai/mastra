# CLI Shared UI Components

This directory contains shared React components used in the Mastra CLI's interactive features. Here's how to set up the development environment:

## Configuration

### TypeScript Configuration

The project uses a references-based TypeScript setup with two configs:

```json:tsconfig.json
{
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../shared/*"]
    }
  }
}
```

### Vite Configuration

Vite is configured to handle the React components and shared module aliases:

```typescript:vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../shared'),
    }
  },
  build: {
    cssCodeSplit: false
  }
});
```

### Tailwind CSS

The styling uses a shared Tailwind configuration that's extended for the chat components:

```typescript:tailwind.config.ts
// Base config in packages/cli/tailwind.config.ts
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      // Theme customizations
    }
  },
  plugins: [require('tailwindcss-animate')]
} satisfies Config;

// Chat-specific config extends the base
import tailwindConfig from '../../../tailwind.config.ts';
export default {
  ...tailwindConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
    '../../shared/**/*.{js,ts,jsx,tsx,html}'
  ]
};
```
