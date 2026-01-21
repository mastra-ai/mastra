import path from "path";
import fs from "fs/promises";

const DOCS_DIR = path.join(process.cwd(), "src", "content", "en");
const OUTPUT_DIR = path.join(process.cwd(), "static");
const OUTPUT_FILENAME = "llms.txt";
const PREFIX_BLOCK = `# Mastra

Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server. It's the easiest way to build, tune, and scale reliable AI products.

Some of its highlights include: Model routing, agents, workflows, human-in-the-loop, context management, and MCP.

The documentation is organized into key sections:

- [**Docs**](https://mastra.ai/docs): Core documentation covering concepts, features, and implementation details
- [**Models**](https://mastra.ai/models): Mastra provides a unified interface for working with LLMs across multiple providers
- [**Guides**](https://mastra.ai/guides): Step-by-step tutorials for building specific applications
- [**Reference**](https://mastra.ai/reference): API reference documentation

Each section contains detailed markdown files that provide comprehensive information about Mastra's features and how to use them effectively.`;

const SIDEBAR_LOCATIONS = [
  {
    id: "Docs",
    path: path.join(DOCS_DIR, "docs", "sidebars.js"),
  },
  {
    id: "Models",
    path: path.join(DOCS_DIR, "models", "sidebars.js"),
  },
  {
    id: "Guides",
    path: path.join(DOCS_DIR, "guides", "sidebars.js"),
  },
  {
    id: "Reference",
    path: path.join(DOCS_DIR, "reference", "sidebars.js"),
  },
];

type SidebarDoc = {
  type: "doc";
  id: string;
  label: string;
  key?: string;
  customProps?: Record<string, unknown>;
};

type SidebarCategory = {
  type: "category";
  label: string;
  collapsed?: boolean;
  customProps?: Record<string, unknown>;
  items: SidebarItem[];
};

type SidebarItem = string | SidebarDoc | SidebarCategory;

type SidebarsConfig = {
  [key: string]: SidebarItem[];
};

/**
 * Get the base URL for a documentation section
 */
function getBaseUrl(sectionId: string): string {
  const baseUrls: Record<string, string> = {
    Docs: "https://mastra.ai/docs",
    Models: "https://mastra.ai/models",
    Guides: "https://mastra.ai/guides",
    Reference: "https://mastra.ai/reference",
  };
  return baseUrls[sectionId] || "https://mastra.ai";
}

/**
 * Get the label for a sidebar item
 */
function getItemLabel(item: SidebarItem): string {
  if (typeof item === "string") {
    // For string items like "index", capitalize first letter
    if (item === "index") return "Overview";
    return item.charAt(0).toUpperCase() + item.slice(1);
  }
  if (item.type === "doc") {
    return item.label;
  }
  if (item.type === "category") {
    return item.label;
  }
  return "";
}

/**
 * Get the doc ID for a sidebar item (for URL generation)
 */
function getDocId(item: SidebarItem): string | null {
  if (typeof item === "string") {
    return item;
  }
  if (item.type === "doc") {
    return item.id;
  }
  return null;
}

/**
 * Generate markdown list for sidebar items recursively
 */
function generateMarkdownList(
  items: SidebarItem[],
  baseUrl: string,
  depth: number = 0,
): string {
  const indent = "  ".repeat(depth);
  let output = "";

  for (const item of items) {
    const label = getItemLabel(item);
    const docId = getDocId(item);

    if (typeof item === "string" || item.type === "doc") {
      // It's a doc item - create a link
      const url =
        docId === "index" ? baseUrl : `${baseUrl}/${docId?.replace("/", "/")}`;
      output += `${indent}- [${label}](${url})\n`;
    } else if (item.type === "category") {
      // It's a category - create a label and recurse
      output += `${indent}- ${label}\n`;
      output += generateMarkdownList(item.items, baseUrl, depth + 1);
    }
  }

  return output;
}

/**
 * Parse a sidebars.js file and extract the sidebar items using dynamic import
 */
async function parseSidebarFile(filePath: string): Promise<SidebarItem[]> {
  // Convert to file:// URL for dynamic import
  const fileUrl = `file://${filePath}`;
  const module = await import(fileUrl);
  const sidebars = module.default as SidebarsConfig;

  const sidebarKey = Object.keys(sidebars)[0];
  return sidebars[sidebarKey];
}

async function buildLlmsTxt(): Promise<void> {
  let output = PREFIX_BLOCK + "\n\n";

  for (const sidebar of SIDEBAR_LOCATIONS) {
    try {
      const items = await parseSidebarFile(sidebar.path);
      const baseUrl = getBaseUrl(sidebar.id);

      output += `## ${sidebar.id}\n\n`;
      output += generateMarkdownList(items, baseUrl);
    } catch (error) {
      console.error(`Error processing ${sidebar.id}:`, error);
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILENAME);
  await fs.writeFile(outputPath, output, "utf-8");

  console.log(`Generated ${outputPath}`);
}

// Run the script
buildLlmsTxt().catch(console.error);
