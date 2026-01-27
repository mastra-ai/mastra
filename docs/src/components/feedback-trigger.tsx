import { useLocalPathname } from '@docusaurus/theme-common/internal'
import { FeedbackForm } from './feedback-form'
import { Button } from './ui/button'
import React, { useState } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@radix-ui/react-dialog'

export const FeedbackTrigger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { siteConfig } = useDocusaurusContext()
  const { mastraWebsite } = siteConfig.customFields as {
    mastraWebsite?: string
  }
  const pathname = useLocalPathname()

  const currentPage = `${mastraWebsite}${pathname}`

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex h-8 w-full items-center justify-center rounded-xl bg-(--mastra-surface-3) px-4 text-sm font-normal hover:opacity-90"
        >
          Share feedback
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-250 bg-black/50 backdrop-blur-[2px] transition-opacity" />
        <DialogContent className="dialog-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[200px] left-1/2 z-260 -translate-x-1/2">
          <div className="relative top-1/2 flex min-h-full items-start justify-center p-4">
            <div className="mx-auto h-fit w-md rounded-xl bg-(--ifm-background-color) shadow-2xl ring ring-neutral-200 transition-all duration-150 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0 dark:border-(--border) dark:bg-(--mastra-surface-2) dark:ring-(--border)">
              <DialogTitle className="sr-only">Send Feedback</DialogTitle>
              <div className="w-full">
                <FeedbackForm isOpen={isOpen} onClose={() => setIsOpen(false)} currentPage={currentPage} />
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
