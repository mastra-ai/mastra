/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "@/mdx-components";
import { Suspense } from "react";
import { readFileSync } from "fs";
import path from "path";

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
  const result = await importPage(mdxPath, locale || "en");
  const { default: MDXContent, toc, metadata } = result;
  let { sourceCode } = result;

  // Fix for sourceCode caching issue - read directly from file system
  // This works around a Nextra bug where sourceCode is cached and returns the same content for all pages
  try {
    if (metadata.filePath) {
      const fullPath = path.join(process.cwd(), metadata.filePath);
      sourceCode = readFileSync(fullPath, "utf-8");
    }
  } catch (error) {
    console.error("Error reading source file:", error);
    // Fall back to the original sourceCode from Nextra
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
        <MDXContent {...props} params={props.params} />
      </Wrapper>
    </Suspense>
  );
}
