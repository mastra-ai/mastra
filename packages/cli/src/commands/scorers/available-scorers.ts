import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ScorerTemplate } from './types';

async function loadRealScorers(): Promise<Array<ScorerTemplate>> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  try {
    const templatesDir = join(__dirname, './templates/scorers');
    const files = readdirSync(templatesDir).filter(file => file.endsWith('.ts'));
    const scorers: ScorerTemplate[] = [];
    
    for (const filename of files) {
      const filePath = join(templatesDir, filename);
      
      try {
        // Use dynamic import for ES modules
        const module = await import(filePath);
        // Get the exported scorer object
        const exportedNames = Object.keys(module);
        const scorerKey = exportedNames.find(key => key.toLowerCase().includes('scorer'));
        
        if (scorerKey && module[scorerKey]) {
          scorers.push(module[scorerKey]);
        }
      } catch (error) {
        console.warn(`Failed to import ${filename}:`, error);
        const id = filename.replace('-scorer.ts', '');
        const content = readFileSync(filePath, 'utf-8');
        scorers.push({ id, content } as ScorerTemplate);
      }
    }
    
    return scorers;
  } catch (error) {
    console.warn('Failed to load real scorers:', error);
    return [];
  }
}

export const AVAILABLE_SCORERS = await loadRealScorers();
