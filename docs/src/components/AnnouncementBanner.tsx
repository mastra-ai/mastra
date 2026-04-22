import Link from '@docusaurus/Link'

export function AnnouncementBanner() {
  return (
    <div className="border-b-[0.5px] border-green-200 bg-green-50 px-4 py-2 dark:border-green-900 dark:bg-green-600/10">
      <div className="text-center text-[--mastra-text-secondary]! lg:mx-auto lg:max-w-250 lg:px-4 lg:text-left">
        The new Mastra platform replaces Mastra Cloud, so we turned off new signups. Please{' '}
        <Link
          href="https://projects.mastra.ai"
          className="text-green-700! underline! hover:no-underline! dark:text-green-400!"
        >
          sign up there
        </Link>{' '}
        or{' '}
        <Link
          href="/docs/guides/migrations/mastra-cloud"
          className="text-green-700! underline! hover:no-underline! dark:text-green-400!"
        >
          migrate your project
        </Link>{' '}
        before June 30.
      </div>
    </div>
  )
}
