import { defineConfig } from 'dts-cli';
import image from '@rollup/plugin-image';

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
