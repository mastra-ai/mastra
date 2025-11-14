import Link from "@docusaurus/Link";
import { translate } from "@docusaurus/Translate";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { type ReactNode } from "react";

import { useLocalPathname } from "@docusaurus/theme-common/internal";

export default function HomeBreadcrumbItem(): ReactNode {
  const homeHref = useBaseUrl("/");
  const localPathname = useLocalPathname();
  const parentRoute = localPathname.split("/")[1];

  return (
    <li className="breadcrumbs__item">
      <Link
        aria-label={translate({
          id: "theme.docs.breadcrumbs.home",
          message: "Home page",
          description: "The ARIA label for the home page in the breadcrumbs",
        })}
        href={homeHref}
      >
        {parentRoute}
      </Link>
    </li>
  );
}
