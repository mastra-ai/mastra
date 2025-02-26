import image from '@rollup/plugin-image';
import { defineConfig } from 'dts-cli';

export default defineConfig({
  rollup: {
    format: 'esm',
    plugins: [
      image({
        include: ['**/*.png', '**/*.jpg', '**/*.svg'],
        dom: true
      })
    ]
  }
});
