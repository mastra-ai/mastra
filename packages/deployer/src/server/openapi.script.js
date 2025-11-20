import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function pullOpenApiSpec() {
  try {
    const response = await fetch('http://localhost:4111/openapi.json');
    const text = await response.text();
    const outputPath = path.join(__dirname, 'openapi.json');

    fs.writeFileSync(outputPath, text);
    console.info('Successfully pulled and saved OpenAPI spec');
  } catch (error) {
    console.error('Failed to pull OpenAPI spec:', error);
    process.exit(1);
  }
}

pullOpenApiSpec();
