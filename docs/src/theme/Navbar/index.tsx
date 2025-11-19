import Link from "@docusaurus/Link";
import { GithubStarCount } from "@site/src/components/github-star-count";
import { MobileDocsDropdown } from "@site/src/components/mobile-docs-dropdown";
import { ThemeSwitcher } from "@site/src/components/theme-switcher";
import VersionControl from "@site/src/components/version-control";
import NavbarLayout from "@theme/Navbar/Layout";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import { type ReactNode } from "react";
import SearchContainer, { AskAI } from "./Search";
import { Logo } from "./logo";
import { TabSwitcher } from "./tab-switcher";

function NavbarContentDesktop() {
  return (
    <div className="flex px-4 border-b-[0.5px] h-(--ifm-navbar-height) border-(--border-subtle) mx-auto w-full items-center justify-between @container">
      <div className="flex gap-2 items-center">
        <Link href="/docs/v1">
          <Logo />
        </Link>
        <div className="hidden @[1262px]:block">
          <TabSwitcher />
        </div>
        <div className="w-[200px] hidden @[1023px]:block @[1262px]:hidden">
          <MobileDocsDropdown />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex items-center">
          <GithubStarCount />
        </div>

        <div className="hidden @[798px]:block">
          <div className="flex gap-2 items-center">
            <SearchContainer locale="en" />
            <AskAI />
          </div>
        </div>
        <NavbarMobileSidebarToggle />
      </div>
    </div>
  );
}

export default function Navbar(): ReactNode {
  return (
    <NavbarLayout>
      <NavbarContentDesktop />
    </NavbarLayout>
  );
}
