import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import Translate from '@docusaurus/Translate'
import { ExternalLinkIcon } from '@site/src/components/copy-page-icons'
import type { Props } from '@theme/EditThisPage'
import { type ReactNode } from 'react'

export default function EditThisPage({ editUrl }: Props): ReactNode {
  const location = useLocation()
  const llmsUrl = `${location.pathname.replace(/\/$/, '')}/llms.txt`

  return (
    <div className="flex items-center gap-6">
      <Link to={editUrl} className="flex items-center gap-1 text-sm text-(--ifm-color-primary-darkest)! no-underline!">
        <ExternalLinkIcon className="size-5" />
        <Translate id="theme.common.editThisPage" description="The link label to edit the current page">
          Edit this page on GitHub
        </Translate>
      </Link>
      <a href={llmsUrl} className="flex items-center gap-1 text-sm text-(--ifm-color-primary-darkest)! no-underline!">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="size-5"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M7.25 3.688a8.035 8.035 0 0 0-4.872-.523A.48.48 0 0 0 2 3.64v7.994c0 .345.342.588.679.512a6.02 6.02 0 0 1 4.571.81V3.688ZM8.75 12.956a6.02 6.02 0 0 1 4.571-.81c.337.075.679-.167.679-.512V3.64a.48.48 0 0 0-.378-.475 8.034 8.034 0 0 0-4.872.523v9.268Z" />
        </svg>
        llms.txt
      </a>
    </div>
  )
}
