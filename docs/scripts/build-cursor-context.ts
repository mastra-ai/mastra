import path from "path";

import fs from "fs/promises";

async function concatenateMDXDocs(
  sourceDir: string,
  outputFile: "llms.txt",
): Promise<void> {
  const allContent: string[] = [];
  const processedFiles: string[] = [];
  const outputDir = path.join(process.cwd(), "public");

  async function processDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.name === outputFile) continue;

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            await processDirectory(fullPath);
          }
        } else if (entry.name.endsWith(".mdx")) {
          try {
            const content = await fs.readFile(fullPath, "utf-8");

            const fileHeader = `\n\n${"=".repeat(80)}\n`;
            const relativePath = path.relative(sourceDir, fullPath);
            const metadata = `Source: ${relativePath}\n${"=".repeat(80)}\n\n`;

            allContent.push(fileHeader + metadata + content);
            processedFiles.push(relativePath);
          } catch (error) {
            console.error(`Error processing ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
  }

  await processDirectory(sourceDir);

  if (allContent.length > 0) {
    try {
      const header = [
        "Combined MDX Documentation",
        "=".repeat(25),
        `Total files processed: ${processedFiles.length}\n`,
        "Files included:",
        ...processedFiles.map((file) => `- ${file}`),
        "\n" + "=".repeat(80) + "\n",
      ].join("\n");

      await fs.writeFile(
        path.join(outputDir, outputFile),
        header + allContent.join(""),
        "utf-8",
      );

      console.log(`Successfully created ${outputFile}`);
      console.log(`Processed ${processedFiles.length} files:`);
      processedFiles.forEach((file) => console.log(`- ${file}`));
    } catch (error) {
      console.error("Error writing output file:", error);
    }
  } else {
    console.log("No MDX files found to concatenate");
  }
}

const docsDir = process.argv[2] || ".";
concatenateMDXDocs(docsDir, "llms.txt").catch((error) =>
  console.error("Script failed:", error),
);
