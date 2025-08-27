/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "@/mdx-components";
import { Suspense } from "react";

export const generateStaticParams = generateStaticParamsFor(
  "mdxPath",
  "locale",
);

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata(props: any) {
  const { locale, mdxPath } = await props.params;
  const { metadata } = await importPage(mdxPath, locale || "en");

  const url = `${baseUrl}/${locale}/${mdxPath?.join("/")}`;
  const title = metadata.title;
  const description = metadata.description as string;

  const image = `${baseUrl}/api/og/docs?title=${title}&description=${description}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url,
      images: [
        {
          url: image,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props: any) {
  const { locale, mdxPath } = await props.params;
  const result = await importPage(mdxPath, locale);
  const { default: MDXContent, toc, metadata, sourceCode } = result;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
        <MDXContent {...props} params={props.params} />
      </Wrapper>
    </Suspense>
  );
}
