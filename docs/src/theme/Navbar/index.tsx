import Link from '@docusaurus/Link'
import { GitHubIconLink } from '@site/src/components/github-icon-link'
import NavbarLayout from '@theme/Navbar/Layout'
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle'
import { ThemeSwitcher } from '@site/src/components/theme-switcher'
import SearchBar from '@theme/SearchBar'
import { type ReactNode } from 'react'
import { AskAI } from './ask-ai'
import { Logo } from './logo'
import { TabSwitcher } from './tab-switcher'
import PlatformCta from '@site/src/components/platform-cta'
import { useLocation } from '@docusaurus/router'
import clsx from 'clsx'

function NavbarContentDesktop() {
  const { pathname } = useLocation()
  const hasPlatformCta = /^\/(?:ja\/)?docs(?:\/|$)/.test(pathname)

  return (
    <div
      className={clsx(
        '@container mx-auto flex h-(--ifm-navbar-height) w-full items-center justify-between px-4',
        hasPlatformCta && 'max-sm:px-2',
      )}
    >
      <div className="flex items-center gap-2">
        <Link
          href="/docs"
          aria-label="mastra.ai, Back to docs homepage"
          className={hasPlatformCta ? 'max-[430px]:[&_svg]:w-24' : undefined}
        >
          <Logo />
        </Link>
        <div className="hidden lg:block">
          <TabSwitcher className={hasPlatformCta ? 'lg:max-xl:px-1 lg:max-xl:[&_.tab]:gap-4' : undefined} />
        </div>
      </div>

      <div className={clsx('flex items-center gap-2', hasPlatformCta && 'max-sm:gap-1')}>
        <div className={clsx('flex items-center gap-2', hasPlatformCta && 'max-sm:gap-0')}>
          <SearchBar />
          <div className="hidden lg:block">
            <AskAI />
          </div>
          <div className="flex items-center">
            <GitHubIconLink />
          </div>
          <ThemeSwitcher />
        </div>
        <PlatformCta placement="header" />
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
