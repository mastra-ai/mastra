import { defineConfig } from 'tsup';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  entry: ['src/index.ts', 'src/stdio.ts'],
  format: ['esm'],
  // Use experimentalDts instead of dts to match the build:cli script
  experimentalDts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: 'smallest',
  // Copy the registry.json file to the dist directory
  onSuccess: async () => {
    try {
      // Create the directory structure if it doesn't exist
      const targetDir = path.join('dist', 'registry');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy the registry.json file
      const sourceFile = path.join('src', 'registry', 'registry.json');
      const targetFile = path.join(targetDir, 'registry.json');

      fs.copyFileSync(sourceFile, targetFile);
      console.log(`Successfully copied ${sourceFile} to ${targetFile}`);
    } catch (error) {
      console.error('Error copying registry.json:', error);
    }
  },
});
