import React, { type ReactNode } from 'react';
import Translate from '@docusaurus/Translate';
import { ThemeClassNames } from '@docusaurus/theme-common';
import Link from '@docusaurus/Link';
import IconEdit from '@theme/Icon/Edit';
import type { Props } from '@theme/EditThisPage';

export default function EditThisPage({ editUrl }: Props): ReactNode {
  return (
    <Link to={editUrl} className="flex items-center gap-2">
      <Translate id="theme.common.editThisPage" description="The link label to edit the current page">
        Edit this page
      </Translate>{' '}
      <svg
        data-testid="geist-icon"
        height="16"
        strokeLinejoin="round"
        viewBox="0 0 16 16"
        width="16"
        style={{ color: 'currentcolor' }}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.5 9.75V11.25C11.5 11.3881 11.3881 11.5 11.25 11.5H4.75C4.61193 11.5 4.5 11.3881 4.5 11.25L4.5 4.75C4.5 4.61193 4.61193 4.5 4.75 4.5H6.25H7V3H6.25H4.75C3.7835 3 3 3.7835 3 4.75V11.25C3 12.2165 3.7835 13 4.75 13H11.25C12.2165 13 13 12.2165 13 11.25V9.75V9H11.5V9.75ZM8.5 3H9.25H12.2495C12.6637 3 12.9995 3.33579 12.9995 3.75V6.75V7.5H11.4995V6.75V5.56066L8.53033 8.52978L8 9.06011L6.93934 7.99945L7.46967 7.46912L10.4388 4.5H9.25H8.5V3Z"
          fill="currentColor"
        ></path>
      </svg>
    </Link>
  );
}
