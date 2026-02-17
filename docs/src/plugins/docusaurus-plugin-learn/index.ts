import type { LoadContext, Plugin } from '@docusaurus/types'
import { course } from '../../learn/course'

export default function pluginLearn(_context: LoadContext): Plugin {
  return {
    name: 'docusaurus-plugin-learn',
    async contentLoaded({ actions }) {
      const { addRoute } = actions

      addRoute({
        path: '/learn',
        component: '@site/src/learn/pages/LearnLandingPage',
        exact: true,
      })

      for (const lesson of course.lessons) {
        addRoute({
          path: `/learn/${lesson.slug}`,
          component: '@site/src/learn/pages/LessonPage',
          exact: true,
        })
      }
    },
  }
}
