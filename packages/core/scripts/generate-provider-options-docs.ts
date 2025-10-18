/**
 * Generate documentation for provider-specific options
 * 
 * This script uses ts-morph to extract type information from the AI SDK packages
 * and generates markdown documentation for each provider's options.
 */

import { Project, Type, TypeFormatFlags, Symbol as TsSymbol } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PropertyInfo {
  name: string;
  type: string;
  description?: string;
  optional: boolean;
}

/**
 * Extract properties from a TypeScript type
 */
function extractPropertiesFromType(type: Type): PropertyInfo[] {
  const properties: PropertyInfo[] = [];
  
  // Get all properties from the type
  const typeProperties = type.getProperties();
  
  for (const prop of typeProperties) {
    const declarations = prop.getDeclarations();
    if (declarations.length === 0) continue;
    
    const declaration = declarations[0];
    const propType = prop.getTypeAtLocation(declaration);
    const propName = prop.getName();
    const isOptional = prop.isOptional();
    
    // Get JSDoc comment if available
    let description: string | undefined;
    const jsDocs = declaration.getJsDocs();
    if (jsDocs.length > 0) {
      description = jsDocs[0].getDescription().trim();
    }
    
    // Format the type string
    const typeStr = propType.getText(undefined, TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    
    properties.push({
      name: propName,
      type: typeStr,
      description,
      optional: isOptional,
    });
  }
  
  return properties;
}

/**
 * Generate markdown documentation for a single property
 */
function generatePropertyDoc(prop: PropertyInfo): string {
  const requiredBadge = prop.optional ? '*Optional*' : '**Required**';
  const description = prop.description || '';

  let doc = `### \`${prop.name}\`\n\n`;
  doc += `${requiredBadge} | Type: \`${prop.type}\`\n\n`;
  
  if (description) {
    doc += `${description}\n\n`;
  }

  return doc;
}

/**
 * Generate markdown documentation for a provider's options
 */
function generateProviderDocs(providerName: string, typeName: string, project: Project): string {
  let markdown = `# ${providerName.charAt(0).toUpperCase() + providerName.slice(1)} Provider Options\n\n`;
  markdown += `Provider-specific options for the ${providerName} AI SDK provider.\n\n`;
  markdown += `## Options\n\n`;
  
  // Find the type in the project
  const sourceFiles = project.getSourceFiles();
  let targetType: Type | undefined;
  
  for (const sourceFile of sourceFiles) {
    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      targetType = typeAlias.getType();
      break;
    }
    
    const interfaceDecl = sourceFile.getInterface(typeName);
    if (interfaceDecl) {
      targetType = interfaceDecl.getType();
      break;
    }
  }
  
  if (!targetType) {
    markdown += `*Type \`${typeName}\` not found.*\n`;
    return markdown;
  }
  
  const properties = extractPropertiesFromType(targetType);
  
  if (properties.length === 0) {
    markdown += '*No provider-specific options available.*\n';
    return markdown;
  }
  
  for (const prop of properties) {
    markdown += generatePropertyDoc(prop);
  }
  
  return markdown;
}

/**
 * Generate provider options section for a specific provider (for use in provider docs)
 */
export function generateProviderOptionsSection(providerId: string): string {
  // Map provider IDs to their type names
  const providerTypeMap: Record<string, { typeName: string; displayName: string }> = {
    'anthropic': { typeName: 'AnthropicProviderOptions', displayName: 'Anthropic' },
    'google': { typeName: 'GoogleGenerativeAIProviderOptions', displayName: 'Google' },
    'openai': { typeName: 'OpenAIResponsesProviderOptions', displayName: 'OpenAI' },
    'xai': { typeName: 'XaiProviderOptions', displayName: 'xAI' },
  };

  const providerInfo = providerTypeMap[providerId];
  if (!providerInfo) {
    return ''; // No provider options for this provider
  }

  // Create a ts-morph project
  const project = new Project({
    tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.json'),
  });

  // Add the AI SDK package source files
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  project.addSourceFilesAtPaths([
    path.join(nodeModulesPath, '@ai-sdk/anthropic-v5/dist/index.d.ts'),
    path.join(nodeModulesPath, '@ai-sdk/google-v5/dist/index.d.ts'),
    path.join(nodeModulesPath, '@ai-sdk/openai-v5/dist/index.d.ts'),
    path.join(nodeModulesPath, '@ai-sdk/xai-v5/dist/index.d.ts'),
  ]);

  // Find the type in the project
  const sourceFiles = project.getSourceFiles();
  let targetType: Type | undefined;
  
  for (const sourceFile of sourceFiles) {
    const typeAlias = sourceFile.getTypeAlias(providerInfo.typeName);
    if (typeAlias) {
      targetType = typeAlias.getType();
      break;
    }
    
    const interfaceDecl = sourceFile.getInterface(providerInfo.typeName);
    if (interfaceDecl) {
      targetType = interfaceDecl.getType();
      break;
    }
  }
  
  if (!targetType) {
    return ''; // Type not found
  }
  
  const properties = extractPropertiesFromType(targetType);
  
  if (properties.length === 0) {
    return ''; // No properties
  }

  // Generate markdown section with PropertiesTable component
  let markdown = `## Provider Options\n\n`;
  markdown += `${providerInfo.displayName} supports the following provider-specific options via the \`providerOptions\` parameter:\n\n`;
  markdown += `\`\`\`typescript\n`;
  markdown += `const response = await agent.generate("Hello!", {\n`;
  markdown += `  providerOptions: {\n`;
  markdown += `    // See available options in the table below\n`;
  markdown += `  }\n`;
  markdown += `});\n`;
  markdown += `\`\`\`\n\n`;
  markdown += `### Available Options\n\n`;
  
  // Generate PropertiesTable component with JSON data
  const tableData = properties.map(prop => ({
    name: prop.name,
    type: prop.type,
    description: prop.description || '',
    isOptional: prop.optional,
  }));
  
  markdown += `<PropertiesTable\n`;
  markdown += `  content={${JSON.stringify(tableData, null, 4)}}\n`;
  markdown += `/>\n\n`;
  
  return markdown;
}

/**
 * Main function to generate all provider options documentation
 */
function main() {
  console.log('Generating provider options documentation...\n');
  
  // Create a ts-morph project
  const project = new Project({
    tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.json'),
  });
  
  // Add the AI SDK package source files
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  project.addSourceFilesAtPaths([
    path.join(nodeModulesPath, '@ai-sdk/anthropic-v5/dist/index.d.ts'),
    path.join(nodeModulesPath, '@ai-sdk/google-v5/dist/index.d.ts'),
    path.join(nodeModulesPath, '@ai-sdk/openai-v5/dist/index.d.ts'),
    path.join(nodeModulesPath, '@ai-sdk/xai-v5/dist/index.d.ts'),
  ]);
  
  // Generate docs for each provider
  const providers = [
    { name: 'anthropic', typeName: 'AnthropicProviderOptions' },
    { name: 'google', typeName: 'GoogleGenerativeAIProviderOptions' },
    { name: 'openai', typeName: 'OpenAIResponsesProviderOptions' },
    { name: 'xai', typeName: 'XaiProviderOptions' },
  ];
  
  for (const { name, typeName } of providers) {
    const docs = generateProviderDocs(name, typeName, project);
    console.log(`\n${'='.repeat(80)}\n`);
    console.log(docs);
  }
  
  console.log('\n✅ Documentation generation complete!');
}

main();
