import Link from "@docusaurus/Link";
import { GithubStarCount } from "@site/src/components/github-star-count";
import LocaleControl from "@site/src/components/gt/LocaleControl";
import { ThemeSwitcher } from "@site/src/components/theme-switcher";
import NavbarLayout from "@theme/Navbar/Layout";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { type ReactNode } from "react";
import SearchContainer from "./Search";
import { Logo } from "./logo";
import { TabSwitcher } from "./tab-switcher";
import { MobileDocsDropdown } from "@site/src/components/mobile-docs-dropdown";

function NavbarContentDesktop() {
  const { i18n } = useDocusaurusContext();
  const locale = i18n?.currentLocale;
  return (
    <>
      <div className="flex px-4 border-b-[0.5px] h-[47px] border-(--border-subtle) mx-auto w-full items-center justify-between @container">
        <div className="flex gap-2 items-center">
          <Link href="/docs">
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
          <div className="hidden @[798px]:block">
            <SearchContainer locale={locale} />
          </div>
          <div className="flex gap-4 items-center">
            <GithubStarCount />
            {/* Adding locale control to header for ease of access in GT implementation*/}

            <div className="hidden lg:flex items-center gap-2">
              <LocaleControl
                size="sm"
                className="px-[13px] bg-white dark:bg-(--mastra-primary) border-transparent rounded-full transition-colors cursor-pointer"
              />
              <ThemeSwitcher />
            </div>
          </div>
          <NavbarMobileSidebarToggle />
        </div>
      </div>
    </>
  );
}

export default function Navbar(): ReactNode {
  return (
    <NavbarLayout>
      <NavbarContentDesktop />
    </NavbarLayout>
  );
}
