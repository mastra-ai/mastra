import path from "path";
import fs from "fs/promises";

function extractFrontMatter(content: string) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  if (!match) return {};

  const frontMatterStr = match[1];
  const result: Record<string, string> = {};

  const fields = ["title", "description"];
  fields.forEach((field) => {
    const match = frontMatterStr.match(new RegExp(`${field}:\\s*([^\n]+)`));
    if (match) {
      result[field] = match[1].trim().replace(/['"]|\\'/g, "");
    }
  });

  return result;
}

function pathToUrl(filePath: string): string {
  // Convert docs file path to URL
  const cleanPath = filePath
    .replaceAll("\\", "/")
    .replace(/^docs\//, "")
    .replace(/\/index\.md$|\.md$/, "");
  return `https://mastra.ai/${cleanPath}`;
}

async function concatenateMDDocs(sourceDir: string) {
  console.log(`Starting documentation generation from: ${sourceDir}`);

  // Validate source directory exists
  try {
    const stats = await fs.stat(sourceDir);
    if (!stats.isDirectory()) {
      throw new Error(`Source path ${sourceDir} is not a directory`);
    }
  } catch (error) {
    console.error(
      `Error accessing source directory: ${error instanceof Error ? error?.message : error}`,
    );
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), "static");
  // Ensure output directory exists
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error(
      `Error creating output directory: ${error instanceof Error ? error?.message : error}`,
    );
    process.exit(1);
  }

  const mdFiles: Array<{
    path: string;
    content: string;
    title: string;
    description?: string;
  }> = [];

  async function processDirectory(dirPath: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            await processDirectory(fullPath);
          }
          continue;
        }

        if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx"))
          continue;

        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const relativePath = path
            .relative(sourceDir, fullPath)
            .replaceAll("\\", "/");
          const frontMatter = extractFrontMatter(content);

          mdFiles.push({
            path: relativePath,
            content,
            title: frontMatter.title || path.basename(relativePath, ".md"),
            description: frontMatter.description,
          });
        } catch (error) {
          console.error(
            `Error processing file ${fullPath}: ${error instanceof Error ? error?.message : error}`,
          );
          // Continue processing other files
        }
      }
    } catch (error) {
      console.error(
        `Error reading directory ${dirPath}: ${error instanceof Error ? error?.message : error}`,
      );
      throw error;
    }
  }

  try {
    await processDirectory(sourceDir);

    if (mdFiles.length === 0) {
      console.warn("No MD files found in the specified directory");
      return;
    }

    // Group files by parent directory
    const groupedFiles = mdFiles.reduce(
      (groups, file) => {
        const firstDir = file.path.split("/")[0];

        if (!groups[firstDir]) {
          groups[firstDir] = [];
        }
        groups[firstDir].push(file);
        return groups;
      },
      {} as Record<string, typeof mdFiles>,
    );

    const indexContent = [
      "# Mastra\n",
      "> Mastra is an open-source TypeScript agent framework designed to provide the essential primitives for building AI applications. " +
        "It enables developers to create AI agents with memory and tool-calling capabilities, implement deterministic LLM workflows, and leverage RAG for knowledge integration. " +
        "With features like model routing, workflow graphs, and automated evals, Mastra provides a complete toolkit for developing, testing, and deploying AI applications.\n\n" +
        "This documentation covers everything from getting started to advanced features, APIs, and best practices for working with Mastra's agent-based architecture.\n\n" +
        "The documentation is organized into key sections:\n" +
        "- **docs**: Core documentation covering concepts, features, and implementation details\n" +
        "- **examples**: Practical examples and use cases demonstrating Mastra's capabilities\n" +
        "- **guides**: Step-by-step tutorials for building specific applications\n" +
        "- **reference**: API reference documentation\n\n" +
        "Each section contains detailed markdown files that provide comprehensive information about Mastra's features and how to use them effectively.\n",
    ];

    for (const [section, files] of Object.entries(groupedFiles)) {
      indexContent.push(`\n## ${section}`);
      for (const file of files) {
        const url = pathToUrl(file.path);
        indexContent.push(
          `- [${file.title}](${url})${file.description ? ": " + file.description : ""}`,
        );
      }
    }

    try {
      await fs.writeFile(
        path.join(outputDir, "llms.txt"),
        indexContent.join("\n"),
        "utf-8",
      );
      console.log("Generated llms.txt at static/llms.txt");
    } catch (error) {
      console.error(
        `Error writing llms.txt: ${error instanceof Error ? error?.message : error}`,
      );
      throw error;
    }
  } catch (error) {
    console.error(
      "Fatal error during documentation generation:",
      error instanceof Error ? error?.message : error,
    );
    process.exit(1);
  }
}

const docsDir = path.join(process.cwd(), "src/content/en/docs");

concatenateMDDocs(docsDir).catch((error) => {
  console.error(
    "Unhandled error:",
    error instanceof Error ? error?.message : error,
  );
  process.exit(1);
});
