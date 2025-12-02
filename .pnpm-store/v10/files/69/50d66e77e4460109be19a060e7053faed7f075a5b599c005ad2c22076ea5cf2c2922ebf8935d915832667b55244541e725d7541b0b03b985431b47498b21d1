import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'jscodeshift',
      social: {
        github: 'https://github.com/facebook/jscodeshift',
      },
      sidebar: [
        {
          label: 'Overview',
          items: [
            // Each item here is one entry in the navigation menu.
            {label: 'Introduction', link: '/overview/introduction/'},
          ],
        },
        {
          label: 'Building',
          items: [
            {label: 'API Reference', link: '/build/api-reference/'},
            {label: 'AST Grammar', link: '/build/ast-grammar/'},
          ],
        },
        {
          label: 'Running',
          items: [
            {label: 'CLI', link: '/run/cli/'},
          ],
        },
      ],
    }),
  ],
});
