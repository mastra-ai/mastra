/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "@/mdx-components";

export const generateStaticParams = generateStaticParamsFor("mdxPath", "locale");

export async function generateMetadata(props: any) {
  const { locale, mdxPath } = await props.params;
  const { metadata } = await importPage(mdxPath, locale || 'en');
  return metadata;
}

export default async function Page(props: any) {
  const Wrapper = getMDXComponents().wrapper;
  const { locale, mdxPath } = await props.params;
  const result = await importPage(mdxPath, locale);
  const { default: MDXContent, toc, metadata } = result;
  return (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent {...props} params={props.params} />
    </Wrapper>
  );
}
