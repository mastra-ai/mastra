import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal';
import { translate } from '@docusaurus/Translate';
import { cn } from '@site/src/css/utils';
import NavbarColorModeToggle from '@theme/Navbar/ColorModeToggle';
import { type ReactNode } from 'react';
import { Logo } from '../../logo';
import { Button } from '@site/src/components/ui/button';

function CloseButton() {
  const mobileSidebar = useNavbarMobileSidebar();
  return (
    <Button
      variant="ghost"
      type="button"
      aria-label={translate({
        id: 'theme.docs.sidebar.closeSidebarButtonAriaLabel',
        message: 'Close navigation bar',
        description: 'The ARIA label for close button of mobile sidebar',
      })}
      className="clean-btn navbar-sidebar__close"
      onClick={() => mobileSidebar.toggle()}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="1"
          y="7.5"
          width="14"
          height="1"
          rx="0.5"
          style={{
            transformOrigin: 'center',
          }}
          className={cn('transition-transform duration-150 ease-ease-out-quad', 'rotate-45')}
        ></rect>
        <rect
          x="1"
          y="7.5"
          width="14"
          height="1"
          rx="0.5"
          style={{
            transformOrigin: 'center',
          }}
          className={cn('transition-transform duration-150 ease-ease-out-quad ', '-rotate-45')}
        ></rect>
      </svg>
    </Button>
  );
}

export default function NavbarMobileSidebarHeader(): ReactNode {
  return (
    <div className="navbar-sidebar__brand">
      <div>
        <Logo />
        <NavbarColorModeToggle />
      </div>
      <CloseButton />
    </div>
  );
}
