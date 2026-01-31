import Link from "@docusaurus/Link";
import Translate from "@docusaurus/Translate";
import { ExternalLinkIcon } from "@site/src/components/copy-page-icons";
import type { Props } from "@theme/EditThisPage";
import { type ReactNode } from "react";

export default function EditThisPage({ editUrl }: Props): ReactNode {
  return (
    <Link to={editUrl} className="flex items-center gap-2">
      <Translate
        id="theme.common.editThisPage"
        description="The link label to edit the current page"
      >
        Edit this page
      </Translate>{" "}
      <ExternalLinkIcon />
    </Link>
  );
}
