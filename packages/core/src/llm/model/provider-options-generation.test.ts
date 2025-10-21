import path from 'path';
import { Project } from 'ts-morph';
import { describe, it, expect } from 'vitest';

describe('Provider Options Documentation Generation', () => {
  const project = new Project({
    tsConfigFilePath: path.join(__dirname, '..', '..', '..', 'tsconfig.json'),
  });

  const getProviderOptionsType = (providerName: string) => {
    const sourceFile = project.addSourceFileAtPath(path.join(__dirname, 'provider-options.ts'));

    const exportedDeclarations = sourceFile.getExportedDeclarations();
    const typeExport = exportedDeclarations.get(providerName);

    if (!typeExport || typeExport.length === 0) {
      return null;
    }

    const declaration = typeExport[0];
    return declaration.getType();
  };

  describe('Anthropic Provider Options', () => {
    it('should extract properties from AnthropicProviderOptions', () => {
      const type = getProviderOptionsType('AnthropicProviderOptions');
      expect(type).toBeDefined();

      const properties = type!.getProperties();
      expect(properties.length).toBeGreaterThan(0);

      const propertyNames = properties.map(p => p.getName());
      // Check for known Anthropic-specific properties
      expect(propertyNames).toContain('thinking');
    });
  });

  describe('xAI Provider Options', () => {
    it('should extract properties from XaiProviderOptions', () => {
      const type = getProviderOptionsType('XaiProviderOptions');
      expect(type).toBeDefined();

      const properties = type!.getProperties();
      expect(properties.length).toBeGreaterThan(0);

      const propertyNames = properties.map(p => p.getName());
      // Check for known xAI-specific properties
      expect(propertyNames).toContain('reasoningEffort');
    });
  });

  describe('Google Provider Options', () => {
    it('should extract properties from GoogleProviderOptions', () => {
      const type = getProviderOptionsType('GoogleProviderOptions');
      expect(type).toBeDefined();

      const properties = type!.getProperties();
      expect(properties.length).toBeGreaterThan(0);

      const propertyNames = properties.map(p => p.getName());
      // Check for known Google-specific properties
      expect(propertyNames).toContain('cachedContent');
    });
  });

  describe('OpenAI Provider Options', () => {
    it('should extract properties from OpenAIProviderOptions', () => {
      const type = getProviderOptionsType('OpenAIProviderOptions');
      expect(type).toBeDefined();

      const properties = type!.getProperties();
      expect(properties.length).toBeGreaterThan(0);

      const propertyNames = properties.map(p => p.getName());
      // Check for known OpenAI-specific properties (Responses API)
      expect(propertyNames).toContain('instructions');
    });
  });

  describe('Provider Options Type Structure', () => {
    it('should have all provider option types exported', () => {
      const sourceFile = project.addSourceFileAtPath(path.join(__dirname, 'provider-options.ts'));

      const exports = sourceFile.getExportedDeclarations();
      const exportedTypeNames = Array.from(exports.keys());

      expect(exportedTypeNames).toContain('AnthropicProviderOptions');
      expect(exportedTypeNames).toContain('GoogleProviderOptions');
      expect(exportedTypeNames).toContain('OpenAIProviderOptions');
      expect(exportedTypeNames).toContain('XaiProviderOptions');
      expect(exportedTypeNames).toContain('ProviderOptions');
    });
  });
});
