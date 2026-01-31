import { promises as fs } from "fs";
import path from "path";

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
      result[field] = match[1].trim().replace(/['"]|\'/g, "");
    }
  });

  return result;
}

// Generates a web URL from a project-relative file path like 'src/content/en/docs/agents/foo.mdx'
function pathToUrl(filePath: string): string {
  const cleanPath = filePath
    .replaceAll("\\", "/")
    .replace(/^src\/content\//, "") // Remove 'src/content/' prefix
    .replace(/\/(index\.mdx|index\.md)$|\.(mdx|md)$/, ""); // Remove file extension and '/index'
  return `https://mastra.ai/${cleanPath}`;
}

interface MDXProcessedFile {
  originalPath: string; // Relative to project root, e.g. src/content/en/docs/agents/foo.mdx
  content: string;
  title: string;
  description?: string;
  language: string;
  topLevelDir: string; // e.g., "docs"
  subSectionName: string; // e.g., "agents"
}

async function generateSectionFiles(sourceDir: string) {
  console.log(
    `Starting section-based documentation generation from: ${sourceDir}`,
  );

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

  const outputDir = path.join(process.cwd(), "public", "context");
  try {
    await fs.rm(outputDir, { recursive: true, force: true }); // Clean output directory
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error(
      `Error creating output directory: ${error instanceof Error ? error?.message : error}`,
    );
    process.exit(1);
  }

  const processedFiles: MDXProcessedFile[] = [];

  // Processes directories recursively to find .mdx and .md files
  async function processDirectoryEntries(
    currentDirPath: string,
    language: string,
    contentRootPath: string,
  ) {
    try {
      const entries = await fs.readdir(currentDirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDirPath, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            await processDirectoryEntries(fullPath, language, contentRootPath);
          }
          continue;
        }

        if (!entry.name.endsWith(".mdx") && !entry.name.endsWith(".md"))
          continue;

        try {
          const fileContent = await fs.readFile(fullPath, "utf-8");
          // Path relative to the content root (e.g., "docs/agents/some-file.mdx")
          const contentRelativePath = path
            .relative(contentRootPath, fullPath)
            .replaceAll("\\", "/");
          // Path relative to project root (e.g., "src/content/en/docs/agents/some-file.mdx")
          const projectRelativePath = path
            .relative(process.cwd(), fullPath)
            .replaceAll("\\", "/");

          const frontMatter = extractFrontMatter(fileContent);
          const pathSegments = contentRelativePath.split("/");

          if (pathSegments.length < 2) {
            // console.warn(`Skipping ${contentRelativePath}: Not enough path segments for topLevelDir/subSectionName.`);
            continue;
          }

          const topLevelDir = pathSegments[0];
          const subSectionName = pathSegments[1];

          processedFiles.push({
            originalPath: projectRelativePath,
            content: fileContent,
            title:
              frontMatter.title ||
              path.basename(
                projectRelativePath,
                path.extname(projectRelativePath),
              ),
            description: frontMatter.description,
            language,
            topLevelDir,
            subSectionName,
          });
        } catch (error) {
          console.error(
            `Error processing file ${fullPath}: ${error instanceof Error ? error?.message : error}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `Error reading directory ${currentDirPath}: ${error instanceof Error ? error?.message : error}`,
      );
      throw error; // Rethrow to stop processing if a directory can't be read
    }
  }

  try {
    const enContentRoot = path.join(sourceDir, "src/content/en");
    await processDirectoryEntries(enContentRoot, "en", enContentRoot);

    if (processedFiles.length === 0) {
      console.warn(
        "No MDX or MD files found in the English content directory.",
      );
      return;
    }

    // Group files by topLevelDir and then by subSectionName
    const groupedFiles = processedFiles.reduce(
      (acc, file) => {
        if (!acc[file.topLevelDir]) {
          acc[file.topLevelDir] = {};
        }
        if (!acc[file.topLevelDir][file.subSectionName]) {
          acc[file.topLevelDir][file.subSectionName] = [];
        }
        acc[file.topLevelDir][file.subSectionName].push(file);
        return acc;
      },
      {} as Record<string, Record<string, MDXProcessedFile[]>>,
    );

    // Generate a concatenated file for each subSection
    for (const [topLevelDir, subSections] of Object.entries(groupedFiles)) {
      const topLevelOutputDir = path.join(outputDir, topLevelDir);
      await fs.mkdir(topLevelOutputDir, { recursive: true });

      for (const [subSectionName, filesInSubSection] of Object.entries(
        subSections,
      )) {
        // Sort files to ensure consistent order, e.g., index files first
        filesInSubSection.sort((a, b) => {
          const aIsIndex = path.basename(a.originalPath).startsWith("index.");
          const bIsIndex = path.basename(b.originalPath).startsWith("index.");
          if (aIsIndex && !bIsIndex) return -1;
          if (!aIsIndex && bIsIndex) return 1;
          return a.originalPath.localeCompare(b.originalPath);
        });

        const subSectionContent = filesInSubSection
          .map((file) => {
            const sourceUrl = pathToUrl(file.originalPath);
            let fileSpecificContent = file.content;
            const languagePrefix = `[${file.language.toUpperCase()}] `;

            // Logic to insert Source URL after title or frontmatter (if they exist)
            const titleMatch = fileSpecificContent.match(/^(#|##)\s+.*$/m);
            if (titleMatch) {
              const titleIndex = fileSpecificContent.indexOf(titleMatch[0]);
              const beforeTitle = fileSpecificContent.slice(
                0,
                titleIndex + titleMatch[0].length,
              );
              const afterTitle = fileSpecificContent.slice(
                titleIndex + titleMatch[0].length,
              );
              fileSpecificContent = `${beforeTitle}\n${languagePrefix}Source: ${sourceUrl}${afterTitle}`;
            } else {
              const frontMatterMatch =
                fileSpecificContent.match(/^---\n[\s\S]*?\n---/m);
              if (frontMatterMatch) {
                const frontMatterIndex = fileSpecificContent.indexOf(
                  frontMatterMatch[0],
                );
                const beforeFrontMatter = fileSpecificContent.slice(
                  0,
                  frontMatterIndex + frontMatterMatch[0].length,
                );
                const afterFrontMatter = fileSpecificContent.slice(
                  frontMatterIndex + frontMatterMatch[0].length,
                );
                fileSpecificContent = `${beforeFrontMatter}\n${languagePrefix}Source: ${sourceUrl}${afterFrontMatter}`;
              } else {
                fileSpecificContent = `${languagePrefix}Source: ${sourceUrl}\n\n${fileSpecificContent}`;
              }
            }
            return fileSpecificContent;
          })
          .join("\n\n---\nFileSeparator---\n\n"); // Separator between concatenated files

        const outputFilePath = path.join(
          topLevelOutputDir,
          `${subSectionName}.txt`,
        );
        await fs.writeFile(outputFilePath, subSectionContent, "utf-8");
        console.log(`Generated ${outputFilePath}`);
      }
    }

    // Generate an index file
    const indexContent = ["# Mastra Documentation Sections\n"];
    for (const topLevelDir of Object.keys(groupedFiles).sort()) {
      indexContent.push(`\n## ${topLevelDir}`);
      const subSections = groupedFiles[topLevelDir];
      for (const subSectionName of Object.keys(subSections).sort()) {
        const filesInSubSection = subSections[subSectionName];
        let sectionTitle =
          subSectionName.charAt(0).toUpperCase() + subSectionName.slice(1);
        let sectionDescription = `Content related to ${sectionTitle} in ${topLevelDir}.`;
        const webUrl = `https://mastra.ai/en/${topLevelDir}/${subSectionName}`;

        const indexFile = filesInSubSection.find((f) =>
          path.basename(f.originalPath).startsWith("index."),
        );

        if (indexFile) {
          sectionTitle = indexFile.title || sectionTitle;
          sectionDescription = indexFile.description || sectionDescription;
        }

        indexContent.push(
          `- [${sectionTitle}](${webUrl})${sectionDescription ? ": " + sectionDescription : ""}`,
        );
      }
    }

    await fs.writeFile(
      path.join(outputDir, "index.txt"),
      indexContent.join("\n"),
      "utf-8",
    );
    console.log("Generated index.txt");
  } catch (error) {
    console.error(
      "Fatal error during documentation generation:",
      error instanceof Error ? error?.message : error,
    );
    process.exit(1);
  }
}

const docsDir = path.resolve(process.argv[2] || "."); // Expect project root as argument
if (!docsDir.startsWith(process.cwd())) {
  console.error("Error: Provided path must be within the project directory");
  process.exit(1);
}
console.log(`Using project root: ${path.resolve(docsDir)}`);

generateSectionFiles(docsDir).catch((error) => {
  console.error(
    "Unhandled error in script execution:",
    error instanceof Error ? error?.message : error,
  );
  process.exit(1);
});
