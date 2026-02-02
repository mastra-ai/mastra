import Link from '@docusaurus/Link'
import { GitHubIconLink } from '@site/src/components/github-icon-link'
import NavbarLayout from '@theme/Navbar/Layout'
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle'
import { type ReactNode } from 'react'
import SearchContainer, { AskAI } from './Search'
import { Logo } from './logo'
import { TabSwitcher } from './tab-switcher'

function NavbarContentDesktop() {
  return (
    <div className="@container mx-auto flex h-(--ifm-navbar-height) w-full items-center justify-between border-b-[0.5px] border-(--border-subtle) px-4">
      <div className="flex items-center gap-2">
        <Link href="/docs" aria-label="mastra.ai, Back to docs homepage">
          <Logo />
        </Link>
        <div className="hidden lg:block">
          <TabSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <GitHubIconLink />
        </div>

        <div className="flex items-center gap-2">
          <SearchContainer locale="en" />
          <div className="hidden lg:block">
            <AskAI />
          </div>
        </div>
        <NavbarMobileSidebarToggle />
      </div>
    </div>
  )
}

export default function Navbar(): ReactNode {
  return (
    <NavbarLayout>
      <NavbarContentDesktop />
    </NavbarLayout>
  )
}
