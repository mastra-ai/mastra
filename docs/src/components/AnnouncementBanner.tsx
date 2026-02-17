export function AnnouncementBanner() {
  return (
    <div className="border-b-[0.5px] border-green-200 bg-green-50 px-4 py-2 dark:border-green-900 dark:bg-green-600/10">
      <div className="text-center text-[--mastra-text-secondary]! lg:mx-auto lg:max-w-250 lg:px-4 lg:text-left">
        Mastra 1.0 is available 🎉{' '}
        <a
          href="https://mastra.ai/blog/announcing-mastra-1"
          target="_blank"
          className="ml-4 text-green-700! underline! hover:no-underline! dark:text-green-400!"
        >
          Read announcement
        </a>
      </div>
    </div>
  )
}
