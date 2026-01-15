import Head from "@docusaurus/Head";
import Admonition from "@theme/Admonition";
import MDXA from "@theme/MDXComponents/A";
import MDXCode from "@theme/MDXComponents/Code";
import MDXDetails from "@theme/MDXComponents/Details";
import MDXHeading from "@theme/MDXComponents/Heading";
import MDXImg from "@theme/MDXComponents/Img";
import MDXLi from "@theme/MDXComponents/Li";
import MDXPre from "@theme/MDXComponents/Pre";
import MDXUl from "@theme/MDXComponents/Ul";
import Mermaid from "@theme/Mermaid";
import { type ComponentProps } from "react";

import BrowserOnly from "@docusaurus/BrowserOnly";
import { useDoc } from "@docusaurus/plugin-content-docs/lib/client/doc.js";
import { CardGrid, CardGridItem } from "@site/src/components/CardGrid";
import { CopyPageButton } from "@site/src/components/copy-page-button";
import GithubLink from "@site/src/components/GithubLink";
import NetlifyLogo from "@site/src/components/NetlifyLogo";
import OperatorsTable from "@site/src/components/OperatorsTable";
import PropertiesTable from "@site/src/components/PropertiesTable";
import ProviderModelsTable from "@site/src/components/ProviderModelsTable";
import YouTube from "@site/src/components/YouTube-player";
import type { MDXComponentsObject } from "@theme/MDXComponents";

// TODO: Do not hide "Copy page" and instead move it to the sidebar

const MDXComponents: MDXComponentsObject = {
  Head,
  details: MDXDetails, // For MD mode support, see https://github.com/facebook/docusaurus/issues/9092#issuecomment-1602902274
  Details: MDXDetails,
  code: MDXCode,
  a: MDXA,
  pre: MDXPre,
  ul: MDXUl,
  li: MDXLi,
  img: MDXImg,
  h1: (props: ComponentProps<"h1">) => {
    const { frontMatter } = useDoc();
    const showCopyButton = (frontMatter as any)?.showCopyButton !== false;
    return (
      <div className="flex justify-between items-start">
        <MDXHeading as="h1" {...props} />
        {showCopyButton ? (
          <BrowserOnly fallback={<div />}>
            {() => (
              <div className="relative hidden @[600px]:block">
                <CopyPageButton />
              </div>
            )}
          </BrowserOnly>
        ) : null}
      </div>
    );
  },
  h2: (props: ComponentProps<"h2">) => <MDXHeading as="h2" {...props} />,
  h3: (props: ComponentProps<"h3">) => <MDXHeading as="h3" {...props} />,
  h4: (props: ComponentProps<"h4">) => <MDXHeading as="h4" {...props} />,
  h5: (props: ComponentProps<"h5">) => <MDXHeading as="h5" {...props} />,
  h6: (props: ComponentProps<"h6">) => <MDXHeading as="h6" {...props} />,
  admonition: Admonition,
  Callout: Admonition,
  mermaid: Mermaid,
  GithubLink,
  NetlifyLogo,
  OperatorsTable,
  ProviderModelsTable,
  PropertiesTable,
  CardGrid,
  CardGridItem,
  YouTube,
};

export default MDXComponents;
