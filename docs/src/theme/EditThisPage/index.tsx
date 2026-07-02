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
    </div>
  )
}
