import React, { type ReactNode } from "react";
import type { Props } from "@theme/Footer/Copyright";

export default function FooterCopyright({ copyright }: Props): ReactNode {
  return (
    <div
      className="footer__copyright"
      // Developer provided the HTML, so assume it's safe.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: copyright }}
    />
  );
}
