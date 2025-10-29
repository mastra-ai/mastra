import { useDoc } from "@docusaurus/plugin-content-docs/client";
import { useLocation } from "@docusaurus/router";
import { useCallback } from "react";

/**
 * Hook for extracting markdown content from doc pages.
 *
 * ⚠️ WARNING: This hook MUST only be used in doc page components (routes under /docs/).
 * It requires the <DocProvider> context which is only available on doc pages.
 *
 * If you see "Hook useDoc is called outside the <DocProvider>" error,
 * it means this hook is being called on a non-doc page (homepage, showcase, etc.).
 */
export const useMarkdownContent = () => {
  const { metadata, frontMatter } = useDoc();
  const location = useLocation();

  const getMarkdownContent = useCallback(() => {
    // Get the main article element which contains the markdown content
    const articleElement = document.querySelector("article .markdown");

    if (!articleElement) {
      return "";
    }

    // Clone the article to avoid modifying the DOM
    const clonedArticle = articleElement.cloneNode(true) as HTMLElement;

    // Remove unwanted elements
    const elementsToRemove = clonedArticle.querySelectorAll(
      "[data-copy-page-button], .theme-edit-this-page, .pagination-nav",
    );
    elementsToRemove.forEach((el) => el.remove());

    // Extract text content while preserving structure
    let markdownText = "";

    // Add frontmatter and metadata
    markdownText += `# ${metadata.title}\n\n`;

    if (metadata.description) {
      markdownText += `${metadata.description}\n\n`;
    }

    markdownText += `Source: ${window.location.origin}${location.pathname}\n\n`;
    markdownText += "---\n\n";

    // Helper function to convert HTML to markdown-like text
    const convertNodeToMarkdown = (node: Node, level = 0): string => {
      let result = "";

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          result += text + " ";
        }
        return result;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();

        // Skip script, style, and other non-content elements
        if (["script", "style", "svg", "img"].includes(tagName)) {
          return "";
        }

        switch (tagName) {
          case "h1":
            result += `\n# ${element.textContent}\n\n`;
            break;
          case "h2":
            result += `\n## ${element.textContent}\n\n`;
            break;
          case "h3":
            result += `\n### ${element.textContent}\n\n`;
            break;
          case "h4":
            result += `\n#### ${element.textContent}\n\n`;
            break;
          case "h5":
            result += `\n##### ${element.textContent}\n\n`;
            break;
          case "h6":
            result += `\n###### ${element.textContent}\n\n`;
            break;
          case "p":
            element.childNodes.forEach((child) => {
              result += convertNodeToMarkdown(child, level);
            });
            result += "\n\n";
            break;
          case "pre":
          case "code":
            const codeText = element.textContent;
            if (
              element.parentElement?.tagName.toLowerCase() === "pre" ||
              tagName === "pre"
            ) {
              result += `\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
            } else {
              result += `\`${codeText}\``;
            }
            break;
          case "ul":
          case "ol":
            element.childNodes.forEach((child, index) => {
              if (child.nodeType === Node.ELEMENT_NODE) {
                const prefix = tagName === "ul" ? "-" : `${index + 1}.`;
                const childElement = child as HTMLElement;
                if (childElement.tagName.toLowerCase() === "li") {
                  result += `${"  ".repeat(level)}${prefix} ${childElement.textContent?.trim()}\n`;
                }
              }
            });
            result += "\n";
            break;
          case "li":
            // Already handled in ul/ol
            break;
          case "blockquote":
            const quoteText = element.textContent
              ?.trim()
              .split("\n")
              .map((line) => `> ${line}`)
              .join("\n");
            result += `\n${quoteText}\n\n`;
            break;
          case "a":
            const href = element.getAttribute("href");
            result += `[${element.textContent}](${href})`;
            break;
          case "strong":
          case "b":
            result += `**${element.textContent}**`;
            break;
          case "em":
          case "i":
            result += `*${element.textContent}*`;
            break;
          case "table":
            // Simple table handling - just preserve the text for now
            result += `\n${element.textContent}\n\n`;
            break;
          default:
            // For other elements, recursively process children
            element.childNodes.forEach((child) => {
              result += convertNodeToMarkdown(child, level);
            });
        }
      }

      return result;
    };

    // Convert the article content to markdown
    clonedArticle.childNodes.forEach((node) => {
      markdownText += convertNodeToMarkdown(node);
    });

    // Clean up extra whitespace
    markdownText = markdownText
      .replace(/\n{3,}/g, "\n\n") // Replace 3+ newlines with 2
      .trim();

    return markdownText;
  }, [metadata, frontMatter, location]);

  return { getMarkdownContent, metadata };
};
