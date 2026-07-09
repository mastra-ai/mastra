import { usePluginData } from '@docusaurus/useGlobalData'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@radix-ui/react-dialog'
import { Button } from '@site/src/components/ui/button'
import { CustomSearch } from '@theme/SearchBar/custom-search'
import { Search as SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

interface SuggestedLink {
  label: string
  description: string
  link: string
}

interface AlgoliaPluginData {
  indexName?: string
  hitsPerPage?: number
  suggestedLinks?: SuggestedLink[]
}

function Shortcut({ shortcut }: { shortcut: string }) {
  const [os, setOS] = useState<'mac' | 'other' | null>(null)

  useEffect(() => {
    setOS(navigator.userAgent.includes('Mac') ? 'mac' : 'other')
  }, [])

  if (!os) {
    return null
  }

  return (
    <kbd className="flex items-center gap-1 py-2 text-xs font-medium text-(--mastra-icons-3)">
      {os === 'mac' ? `⌘ ${shortcut}` : `CTRL + ${shortcut}`}
    </kbd>
  )
}

export default function SearchBar() {
  const pluginData = usePluginData('docusaurus-plugin-algolia') as AlgoliaPluginData | undefined
  const [isOpen, setIsOpen] = useState(false)

  useHotkeys('mod+k', () => setIsOpen((open: boolean) => !open))

  const searchOptions = {
    indexName: pluginData?.indexName,
    hitsPerPage: pluginData?.hitsPerPage,
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setIsOpen(true)}
          size="sm"
          variant="ghost"
          className="w-9 cursor-pointer items-center gap-2 border-[0.5px] border-transparent text-sm font-normal lg:w-46 lg:border-(--border) lg:bg-(--mastra-surface-4) xl:w-64"
          aria-label="Search documentation (Meta + K)"
        >
          <SearchIcon className="text-(--mastra-icons-1)" />
          <span className="hidden text-sm text-(--mastra-icons-2) lg:block">Search documentation</span>
          <div className="ml-auto hidden xl:block">
            <Shortcut shortcut="K" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-250 bg-black/30 backdrop-blur-[2px] transition-opacity">
          <DialogContent
            aria-describedby={undefined}
            className="dialog-panel relative z-260 mx-auto my-8 max-w-3xl p-6 lg:my-[15vh]"
          >
            <DialogTitle className="sr-only">Search documentation</DialogTitle>
            <div className="mastra-card mx-auto h-fit w-full overflow-hidden rounded-(--mastra-radius-sm) border-2 border-(--algolia-border) bg-(--algolia-bg)">
              <CustomSearch
                searchOptions={searchOptions}
                closeModal={() => setIsOpen(false)}
                suggestedLinks={pluginData?.suggestedLinks ?? []}
              />
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </Dialog>
  )
}
