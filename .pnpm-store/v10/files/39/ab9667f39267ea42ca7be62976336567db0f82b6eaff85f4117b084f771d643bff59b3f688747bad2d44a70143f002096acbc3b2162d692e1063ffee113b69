"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var generateAgents_exports = {};
__export(generateAgents_exports, {
  initClaudeCodeRepo: () => initClaudeCodeRepo,
  initOpencodeRepo: () => initOpencodeRepo,
  initVSCodeRepo: () => initVSCodeRepo
});
module.exports = __toCommonJS(generateAgents_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_utilsBundle = require("playwright-core/lib/utilsBundle");
class AgentParser {
  static async parseFile(filePath) {
    const rawMarkdown = await import_fs.default.promises.readFile(filePath, "utf-8");
    const { header, content } = this.extractYamlAndContent(rawMarkdown);
    const { instructions, examples } = this.extractInstructionsAndExamples(content);
    return { header, instructions, examples };
  }
  static extractYamlAndContent(markdown) {
    const lines = markdown.split("\n");
    if (lines[0] !== "---")
      throw new Error("Markdown file must start with YAML front matter (---)");
    let yamlEndIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        yamlEndIndex = i;
        break;
      }
    }
    if (yamlEndIndex === -1)
      throw new Error("YAML front matter must be closed with ---");
    const yamlLines = lines.slice(1, yamlEndIndex);
    const yamlRaw = yamlLines.join("\n");
    const contentLines = lines.slice(yamlEndIndex + 1);
    const content = contentLines.join("\n");
    let header;
    try {
      header = import_utilsBundle.yaml.parse(yamlRaw);
    } catch (error) {
      throw new Error(`Failed to parse YAML header: ${error.message}`);
    }
    if (!header.name)
      throw new Error('YAML header must contain a "name" field');
    if (!header.description)
      throw new Error('YAML header must contain a "description" field');
    return { header, content };
  }
  static extractInstructionsAndExamples(content) {
    const examples = [];
    const instructions = content.split("<example>")[0].trim();
    const exampleRegex = /<example>([\s\S]*?)<\/example>/g;
    let match;
    while ((match = exampleRegex.exec(content)) !== null) {
      const example = match[1].trim();
      examples.push(example.replace(/[\n]/g, " ").replace(/ +/g, " "));
    }
    return { instructions, examples };
  }
}
const claudeToolMap = /* @__PURE__ */ new Map([
  ["ls", ["Glob"]],
  ["grep", ["Grep"]],
  ["read", ["Read"]],
  ["edit", ["Edit", "MultiEdit"]],
  ["write", ["Write"]]
]);
const commonMcpServers = {
  playwrightTest: {
    type: "local",
    command: "npx",
    args: ["playwright", "run-test-mcp-server"]
  }
};
function saveAsClaudeCode(agent) {
  function asClaudeTool(tool) {
    const [first, second] = tool.split("/");
    if (!second)
      return (claudeToolMap.get(first) || [first]).join(", ");
    return `mcp__${first}__${second}`;
  }
  const lines = [];
  lines.push(`---`);
  lines.push(`name: playwright-test-${agent.header.name}`);
  lines.push(`description: ${agent.header.description}. Examples: ${agent.examples.map((example) => `<example>${example}</example>`).join("")}`);
  lines.push(`tools: ${agent.header.tools.map((tool) => asClaudeTool(tool)).join(", ")}`);
  lines.push(`model: ${agent.header.model}`);
  lines.push(`color: ${agent.header.color}`);
  lines.push(`---`);
  lines.push("");
  lines.push(agent.instructions);
  return lines.join("\n");
}
const opencodeToolMap = /* @__PURE__ */ new Map([
  ["ls", ["ls", "glob"]],
  ["grep", ["grep"]],
  ["read", ["read"]],
  ["edit", ["edit"]],
  ["write", ["write"]]
]);
function saveAsOpencodeJson(agents) {
  function asOpencodeTool(tools, tool) {
    const [first, second] = tool.split("/");
    if (!second) {
      for (const tool2 of opencodeToolMap.get(first) || [first])
        tools[tool2] = true;
    } else {
      tools[`${first}*${second}`] = true;
    }
  }
  const result = {};
  result["$schema"] = "https://opencode.ai/config.json";
  result["mcp"] = {};
  result["tools"] = {
    "playwright*": false
  };
  result["agent"] = {};
  for (const agent of agents) {
    const tools = {};
    result["agent"]["playwright-test-" + agent.header.name] = {
      description: agent.header.description,
      mode: "subagent",
      prompt: `{file:.opencode/prompts/playwright-test-${agent.header.name}.md}`,
      tools
    };
    for (const tool of agent.header.tools)
      asOpencodeTool(tools, tool);
  }
  const server = commonMcpServers.playwrightTest;
  result["mcp"]["playwright-test"] = {
    type: server.type,
    command: [server.command, ...server.args],
    enabled: true
  };
  return JSON.stringify(result, null, 2);
}
async function loadAgents() {
  const files = await import_fs.default.promises.readdir(__dirname);
  return Promise.all(files.filter((file) => file.endsWith(".md")).map((file) => AgentParser.parseFile(import_path.default.join(__dirname, file))));
}
async function writeFile(filePath, content) {
  console.log(`Writing file: ${filePath}`);
  await import_fs.default.promises.writeFile(filePath, content, "utf-8");
}
async function initClaudeCodeRepo() {
  const agents = await loadAgents();
  await import_fs.default.promises.mkdir(".claude/agents", { recursive: true });
  for (const agent of agents)
    await writeFile(`.claude/agents/playwright-test-${agent.header.name}.md`, saveAsClaudeCode(agent));
  await writeFile(".mcp.json", JSON.stringify({
    mcpServers: {
      "playwright-test": {
        command: commonMcpServers.playwrightTest.command,
        args: commonMcpServers.playwrightTest.args
      }
    }
  }, null, 2));
}
const vscodeToolMap = /* @__PURE__ */ new Map([
  ["ls", ["search/listDirectory", "search/fileSearch"]],
  ["grep", ["search/textSearch"]],
  ["read", ["search/readFile"]],
  ["edit", ["edit/editFiles"]],
  ["write", ["edit/createFile", "edit/createDirectory"]]
]);
const vscodeToolsOrder = ["edit/createFile", "edit/createDirectory", "edit/editFiles", "search/fileSearch", "search/textSearch", "search/listDirectory", "search/readFile"];
const vscodeMcpName = "playwright-test";
function saveAsVSCodeChatmode(agent) {
  function asVscodeTool(tool) {
    const [first, second] = tool.split("/");
    if (second)
      return `${vscodeMcpName}/${second}`;
    return vscodeToolMap.get(first) || first;
  }
  const tools = agent.header.tools.map(asVscodeTool).flat().sort((a, b) => {
    const indexA = vscodeToolsOrder.indexOf(a);
    const indexB = vscodeToolsOrder.indexOf(b);
    if (indexA === -1 && indexB === -1)
      return a.localeCompare(b);
    if (indexA === -1)
      return 1;
    if (indexB === -1)
      return -1;
    return indexA - indexB;
  }).map((tool) => `'${tool}'`).join(", ");
  const lines = [];
  lines.push(`---`);
  lines.push(`description: ${agent.header.description}.`);
  lines.push(`tools: [${tools}]`);
  lines.push(`---`);
  lines.push("");
  lines.push(agent.instructions);
  for (const example of agent.examples)
    lines.push(`<example>${example}</example>`);
  return lines.join("\n");
}
async function initVSCodeRepo() {
  const agents = await loadAgents();
  await import_fs.default.promises.mkdir(".github/chatmodes", { recursive: true });
  for (const agent of agents)
    await writeFile(`.github/chatmodes/${agent.header.name === "planner" ? " " : ""}\u{1F3AD} ${agent.header.name}.chatmode.md`, saveAsVSCodeChatmode(agent));
  await import_fs.default.promises.mkdir(".vscode", { recursive: true });
  const mcpJsonPath = ".vscode/mcp.json";
  let mcpJson = {
    servers: {},
    inputs: []
  };
  try {
    mcpJson = JSON.parse(import_fs.default.readFileSync(mcpJsonPath, "utf8"));
  } catch {
  }
  if (!mcpJson.servers)
    mcpJson.servers = {};
  mcpJson.servers["playwright-test"] = {
    type: "stdio",
    command: commonMcpServers.playwrightTest.command,
    args: commonMcpServers.playwrightTest.args
  };
  await writeFile(mcpJsonPath, JSON.stringify(mcpJson, null, 2));
}
async function initOpencodeRepo() {
  const agents = await loadAgents();
  await import_fs.default.promises.mkdir(".opencode/prompts", { recursive: true });
  for (const agent of agents) {
    const prompt = [agent.instructions];
    prompt.push("");
    prompt.push(...agent.examples.map((example) => `<example>${example}</example>`));
    await writeFile(`.opencode/prompts/playwright-test-${agent.header.name}.md`, prompt.join("\n"));
  }
  await writeFile("opencode.json", saveAsOpencodeJson(agents));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  initClaudeCodeRepo,
  initOpencodeRepo,
  initVSCodeRepo
});
