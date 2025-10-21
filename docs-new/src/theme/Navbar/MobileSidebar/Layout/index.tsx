import React, { version, type ReactNode } from 'react';
import clsx from 'clsx';
import { useNavbarSecondaryMenu } from '@docusaurus/theme-common/internal';
import { ThemeClassNames } from '@docusaurus/theme-common';
import type { Props } from '@theme/Navbar/MobileSidebar/Layout';
import { cn } from '@site/src/css/utils';

// TODO Docusaurus v4: remove temporary inert workaround
//  See https://github.com/facebook/react/issues/17157
//  See https://github.com/radix-ui/themes/pull/509
function inertProps(inert: boolean) {
  const isBeforeReact19 = parseInt(version!.split('.')[0]!, 10) < 19;
  if (isBeforeReact19) {
    return { inert: inert ? '' : undefined };
  }
  return { inert };
}

function NavbarMobileSidebarPanel({ children, inert }: { children: ReactNode; inert: boolean }) {
  const props = typeof inertProps(inert) === 'string' ? inertProps(inert) : {};
  return (
    <div className={cn(ThemeClassNames.layout.navbar.mobileSidebar.panel, 'navbar-sidebar__item menu')} {...props}>
      {children}
    </div>
  );
}

export default function NavbarMobileSidebarLayout({ header, primaryMenu, secondaryMenu }: Props): ReactNode {
  const { shown: secondaryMenuShown } = useNavbarSecondaryMenu();
  return (
    <div className={cn(ThemeClassNames.layout.navbar.mobileSidebar.container, 'navbar-sidebar')}>
      {header}
      <div
        className={cn('navbar-sidebar__items', {
          'navbar-sidebar__items--show-secondary': secondaryMenuShown,
        })}
      >
        <NavbarMobileSidebarPanel inert={secondaryMenuShown}>{primaryMenu}</NavbarMobileSidebarPanel>
        <NavbarMobileSidebarPanel inert={!secondaryMenuShown}>{secondaryMenu}</NavbarMobileSidebarPanel>
      </div>
    </div>
  );
}
