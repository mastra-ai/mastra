import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '../../templates');

const MODEL_EXAMPLES = {
  openai: 'openai/gpt-4o-mini',
  anthropic: 'anthropic/claude-sonnet-4-5-20250929',
  google: 'google/gemini-2.5-pro',
  groq: 'groq/llama-3.3-70b-versatile',
  cerebras: 'cerebras/llama-3.3-70b',
  mistral: 'mistral/mistral-medium-2508',
};

async function updateAgentFiles(templatePath) {
  const agentsDir = path.join(templatePath, 'src/mastra/agents');

  try {
    const files = await fs.readdir(agentsDir);

    for (const file of files) {
      if (!file.endsWith('.ts')) continue;

      const filePath = path.join(agentsDir, file);
      let content = await fs.readFile(filePath, 'utf-8');

      // Remove provider imports
      content = content.replace(/import\s+{\s*\w+\s*}\s+from\s+['"]@ai-sdk\/\w+['"];\s*\n/g, '');

      // Replace model: openai('...') or anthropic('...') with process.env.MODEL
      content = content.replace(
        /model:\s*(openai|anthropic|google|groq|cerebras|mistral)\(['"]([^'"]+)['"]\)/g,
        (match, provider, modelName) => `model: process.env.MODEL || '${provider}/${modelName}'`,
      );

      // Replace model: 'provider/model' with process.env.MODEL || 'provider/model'
      content = content.replace(
        /model:\s*['"](\w+\/[^'"]+)['"]/g,
        (match, modelStr) => `model: process.env.MODEL || '${modelStr}'`,
      );

      await fs.writeFile(filePath, content);
      console.log(`✓ Updated ${file}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error updating agents in ${templatePath}:`, error);
    }
  }
}

async function updateWorkflowFiles(templatePath) {
  const workflowsDir = path.join(templatePath, 'src/mastra/workflows');

  try {
    const files = await fs.readdir(workflowsDir);

    for (const file of files) {
      if (!file.endsWith('.ts')) continue;

      const filePath = path.join(workflowsDir, file);
      let content = await fs.readFile(filePath, 'utf-8');

      // Remove provider imports if they're not used elsewhere
      const hasProviderUsage = /(?:openai|anthropic|google|groq|cerebras|mistral)\s*\(/.test(content);

      if (!hasProviderUsage) {
        content = content.replace(/import\s+{\s*\w+\s*}\s+from\s+['"]@ai-sdk\/\w+['"];\s*\n/g, '');
      }

      // Replace inline model usage in workflows
      content = content.replace(
        /(openai|anthropic|google|groq|cerebras|mistral)\(['"]([^'"]+)['"]\)/g,
        (match, provider, modelName, offset) => {
          // Check if this is in a variable declaration or inline usage
          const beforeMatch = content.substring(Math.max(0, offset - 50), offset);
          if (beforeMatch.includes('const') || beforeMatch.includes('let')) {
            return match; // Keep it if it's a variable
          }
          return `process.env.MODEL || '${provider}/${modelName}'`;
        },
      );

      await fs.writeFile(filePath, content);
      console.log(`✓ Updated ${file}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error updating workflows in ${templatePath}:`, error);
    }
  }
}

async function updatePackageJson(templatePath) {
  const packageJsonPath = path.join(templatePath, 'package.json');

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    // Remove all @ai-sdk provider dependencies except those needed by @mastra/core
    const providersToRemove = [
      '@ai-sdk/openai',
      '@ai-sdk/anthropic',
      '@ai-sdk/google',
      '@ai-sdk/google-vertex',
      '@ai-sdk/groq',
      '@ai-sdk/mistral',
    ];

    for (const provider of providersToRemove) {
      if (packageJson.dependencies?.[provider]) {
        delete packageJson.dependencies[provider];
        console.log(`✓ Removed ${provider} from dependencies`);
      }
    }

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  } catch (error) {
    console.error(`Error updating package.json in ${templatePath}:`, error);
  }
}

async function updateEnvExample(templatePath) {
  const envPath = path.join(templatePath, '.env.example');

  try {
    let content = await fs.readFile(envPath, 'utf-8');

    // Add MODEL variable at the top if it doesn't exist
    if (!content.includes('MODEL=')) {
      const modelSection = `# Model Configuration
# Specify your preferred AI model using the format: provider/model-name
# Examples:
#   openai/gpt-4o-mini
#   anthropic/claude-sonnet-4-5-20250929
#   google/gemini-2.5-pro
#   groq/llama-3.3-70b-versatile
MODEL=openai/gpt-4o-mini

`;
      content = modelSection + content;
    }

    // Add API keys section if not present
    const apiKeysSection = `
# API Keys (only needed for your chosen provider)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=
CEREBRAS_API_KEY=
MISTRAL_API_KEY=
`;

    // Check if we need to add API keys
    if (!content.includes('ANTHROPIC_API_KEY') && content.includes('OPENAI_API_KEY')) {
      // Replace single OPENAI_API_KEY section with all provider keys
      content = content.replace(/OPENAI_API_KEY=.*/, apiKeysSection.trim());
    }

    await fs.writeFile(envPath, content);
    console.log(`✓ Updated .env.example`);
  } catch (error) {
    console.error(`Error updating .env.example in ${templatePath}:`, error);
  }
}

async function updateReadme(templatePath) {
  const readmePath = path.join(templatePath, 'README.md');

  try {
    let content = await fs.readFile(readmePath, 'utf-8');

    // Add multi-provider section after ## Getting Started or ## Setup
    const multiProviderSection = `
## Model Configuration

This template supports any AI model provider through Mastra's model router. You can use models from:

- **OpenAI**: \`openai/gpt-4o-mini\`, \`openai/gpt-4o\`
- **Anthropic**: \`anthropic/claude-sonnet-4-5-20250929\`, \`anthropic/claude-haiku-4-5-20250929\`
- **Google**: \`google/gemini-2.5-pro\`, \`google/gemini-2.0-flash-exp\`
- **Groq**: \`groq/llama-3.3-70b-versatile\`, \`groq/llama-3.1-8b-instant\`
- **Cerebras**: \`cerebras/llama-3.3-70b\`
- **Mistral**: \`mistral/mistral-medium-2508\`

Set the \`MODEL\` environment variable in your \`.env\` file to your preferred model.

`;

    // Insert after "Getting Started" or "Setup" section
    if (content.includes('## Getting Started') || content.includes('## Setup')) {
      const marker = content.includes('## Getting Started') ? '## Getting Started' : '## Setup';
      const parts = content.split(marker);

      // Find the next ## header
      const nextSection = parts[1].indexOf('\n## ');
      if (nextSection !== -1) {
        const before = parts[0] + marker + parts[1].substring(0, nextSection);
        const after = parts[1].substring(nextSection);
        content = before + '\n' + multiProviderSection + after;
      }
    }

    // Update any provider-specific references to be generic
    content = content.replace(/OpenAI API key/gi, 'API key for your chosen provider');
    content = content.replace(/Get your OpenAI API key from/gi, 'Get your API key from');

    await fs.writeFile(readmePath, content);
    console.log(`✓ Updated README.md`);
  } catch (error) {
    console.error(`Error updating README.md in ${templatePath}:`, error);
  }
}

async function updateTemplate(templateName) {
  console.log(`\n📦 Processing template: ${templateName}`);
  const templatePath = path.join(TEMPLATES_DIR, templateName);

  await updateAgentFiles(templatePath);
  await updateWorkflowFiles(templatePath);
  await updatePackageJson(templatePath);
  await updateEnvExample(templatePath);
  await updateReadme(templatePath);

  console.log(`✅ Completed ${templateName}\n`);
}

async function main() {
  console.log('🚀 Starting template update to model router pattern...\n');

  const templates = await fs.readdir(TEMPLATES_DIR);

  for (const template of templates) {
    const templatePath = path.join(TEMPLATES_DIR, template);
    const stat = await fs.stat(templatePath);

    if (stat.isDirectory() && template !== 'README.md') {
      await updateTemplate(template);
    }
  }

  console.log('✨ All templates updated successfully!');
}

main().catch(error => {
  console.error('Error updating templates:', error);
  process.exit(1);
});
