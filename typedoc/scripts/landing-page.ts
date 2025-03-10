import path from 'path';
import fs from 'fs/promises';
import {
  CORE_PACKAGES,
  CLIENT_SDKS,
  DEPLOYERS,
  INTEGRATIONS,
  SPEECH_PACKAGES,
  STORE_PACKAGES,
  VOICE_PACKAGES,
} from './packages.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateLandingPage() {
  const categories = [
    { name: 'Deployers', packages: DEPLOYERS },
    { name: 'Integrations', packages: INTEGRATIONS },
    { name: 'Client SDKs', packages: CLIENT_SDKS },
    { name: 'Core Packages', packages: CORE_PACKAGES },
    { name: 'Speech Packages', packages: SPEECH_PACKAGES },
    { name: 'Store Packages', packages: STORE_PACKAGES },
    { name: 'Voice Packages', packages: VOICE_PACKAGES },
  ];

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Mastra Documentation</title>
    <style>
        :root {
            --color-background: #0a0a0a;
            --color-text: #e4e4e4;
            --color-text-aside: #a3a3a3;
            --color-link: #ffffff;
            --color-menu-divider: #2d2d2d;
            --color-background-secondary: #141415;
            --color-card-border: #2d2d2d;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            color: var(--color-text);
            background: var(--color-background);
            font-size: 14px;
        }

        h1 { 
            color: #ffffff;
            margin-bottom: 2rem;
            font-weight: 500;
            font-size: 2rem;
        }

        h2 { 
            color: #ffffff;
            border-bottom: none;
            padding-bottom: 0.5rem;
            margin-top: 3rem;
            font-weight: 500;
        }

        .category {
            margin-bottom: 3rem;
        }

        .packages {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1rem;
            margin-top: 1.5rem;
        }

        .package-card {
            border: 1px solid var(--color-card-border);
            border-radius: 0.375rem;
            padding: 1.25rem;
            background: var(--color-background-secondary);
            transition: all 0.2s ease;
        }

        .package-card:hover {
            transform: translateY(-2px);
            border-color: var(--color-link);
        }

        .package-card h3 {
            margin: 0 0 0.5rem 0;
            color: #ffffff;
            font-weight: 500;
            font-size: 1rem;
        }

        .package-card p {
            margin: 0;
            color: var(--color-text-aside);
            font-size: 0.9rem;
        }

        a {
            color: var(--color-link);
            text-decoration: none;
            transition: color 0.2s ease;
            background: transparent !important;
        }

        a:hover {
            color: #ffffff;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <h1>Mastra Documentation</h1>
    ${categories
      .map(
        category => `
        <div class="category">
            <h2>${category.name}</h2>
            <div class="packages">
                ${category.packages
                  .map(
                    pkg => `
                    <div class="package-card">
                        <h3><a href="packages/${pkg.name}/index.html">${pkg.displayName}</a></h3>
                        <p>${pkg.path}</p>  
                    </div>
                `,
                  )
                  .join('')}
            </div>
        </div>
    `,
      )
      .join('')}
</body>
</html>
  `;

  const outputPath = path.resolve(__dirname, '..', 'generated', 'index.html');
  await fs.writeFile(outputPath, html);
  console.log('✓ Generated landing page');
}
