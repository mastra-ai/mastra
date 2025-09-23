import { BaseDialect } from './base';
import { DialectConfig, SupportedDialect } from './types';

type DialectConstructor = new (config: DialectConfig) => BaseDialect;

export class DialectFactory {
  private static dialectMap: Map<SupportedDialect, () => Promise<DialectConstructor>> = new Map();

  static {
    // Register dialect loaders
    this.dialectMap.set('postgresql', () => import('./postgresql').then(m => m.PostgreSQLDialect));
    this.dialectMap.set('mysql', () => import('./mysql').then(m => m.MySQLDialect));
    this.dialectMap.set('sqlite', () => import('./sqlite').then(m => m.SQLiteDialect));
    this.dialectMap.set('turso', () => import('./turso').then(m => m.TursoDialect));
    this.dialectMap.set('planetscale', () => import('./planetscale').then(m => m.PlanetScaleDialect));
    this.dialectMap.set('neon', () => import('./neon').then(m => m.NeonDialect));
  }

  static async create(config: DialectConfig): Promise<BaseDialect> {
    const loader = this.dialectMap.get(config.type);

    if (!loader) {
      throw new Error(
        `Unsupported dialect: ${config.type}. Supported dialects: ${Array.from(this.dialectMap.keys()).join(', ')}`,
      );
    }

    try {
      const DialectClass = await loader();
      return new DialectClass(config);
    } catch (error: any) {
      // Check if it's a missing dependency error
      if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
        throw new Error(
          `Failed to load dialect '${config.type}'. ` +
            `Make sure the required database driver is installed. ` +
            `For ${config.type}, you may need to install additional packages.`,
        );
      }
      throw error;
    }
  }

  static register(type: SupportedDialect, loader: () => Promise<DialectConstructor>): void {
    this.dialectMap.set(type, loader);
  }

  static getSupported(): SupportedDialect[] {
    return Array.from(this.dialectMap.keys());
  }

  static isSupported(type: string): type is SupportedDialect {
    return this.dialectMap.has(type as SupportedDialect);
  }
}
