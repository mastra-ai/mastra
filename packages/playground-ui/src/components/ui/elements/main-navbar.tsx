import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { HeaderGroup } from '@/ds/components/Header';
import { Button } from '@/ds/components/Button';
import { DividerIcon } from '@/ds/icons/DividerIcon';
import React from 'react';

type Breadcrumb = {
  label: string;
  to: string;
  isCurrent?: boolean;
};

type Action = {
  label: string;
  to: string;
};

type AgentHeaderProps = {
  linkComponent: any;
  breadcrumbItems: Breadcrumb[];
  navItems?: Action[][];
};

export function MainNavbar({ linkComponent, breadcrumbItems, navItems }: AgentHeaderProps) {
  if (!linkComponent) {
    console.warn("linkComponent is not provided, but it'required!");
    return null;
  }

  return (
    <>
      {breadcrumbItems && breadcrumbItems.length > 0 && (
        <Breadcrumb>
          {breadcrumbItems.map((item, index) => (
            <Crumb
              key={index}
              as={linkComponent}
              to={item.to}
              isCurrent={item.isCurrent}
              className={item.isCurrent ? 'text-white' : 'text-icon3'}
            >
              {item.label}
            </Crumb>
          ))}
        </Breadcrumb>
      )}

      {navItems && navItems.length > 0 && (
        <HeaderGroup>
          {navItems.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {group.map((item, itemIndex) => (
                <React.Fragment key={itemIndex}>
                  <Button as={linkComponent} to={item.to}>
                    {item.label}
                  </Button>
                </React.Fragment>
              ))}
              {groupIndex < navItems.length - 1 && <DividerIcon />}
            </React.Fragment>
          ))}
        </HeaderGroup>
      )}
    </>
  );
}
