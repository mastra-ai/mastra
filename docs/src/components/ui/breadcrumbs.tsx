import React, { type ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";

export function BreadcrumbsItemLink({
  children,
  href,
  isLast,
}: {
  children: ReactNode;
  href: string | undefined;
  isLast: boolean;
}): ReactNode {
  const className = "breadcrumbs__link";
  if (isLast) {
    return <span className={className}>{children}</span>;
  }
  return href ? (
    <Link className={className} href={href}>
      <span>{children}</span>
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

export function BreadcrumbsItem({
  children,
  active,
}: {
  children: ReactNode;
  active?: boolean;
}): ReactNode {
  return (
    <li
      className={clsx("breadcrumbs__item", {
        "breadcrumbs__item--active": active,
      })}
    >
      {children}
    </li>
  );
}
