import { describe, it, expect } from 'vitest';
import { validateDSQLConfig, extractRegionFromHost, getEffectiveRegion, DSQL_POOL_DEFAULTS } from './config';
import type { DSQLConfig } from './config';

describe('config utilities', () => {
  describe('validateDSQLConfig', () => {
    const validConfig: DSQLConfig = {
      id: 'test-store',
      host: 'cluster.dsql.us-east-1.on.aws',
    };

    describe('id validation', () => {
      it('should throw if id is missing', () => {
        const config = { host: 'cluster.dsql.us-east-1.on.aws' } as DSQLConfig;
        expect(() => validateDSQLConfig(config)).toThrow('DSQLStore: id must be provided and cannot be empty.');
      });

      it('should throw if id is empty string', () => {
        const config: DSQLConfig = { id: '', host: 'cluster.dsql.us-east-1.on.aws' };
        expect(() => validateDSQLConfig(config)).toThrow('DSQLStore: id must be provided and cannot be empty.');
      });

      it('should throw if id is whitespace only', () => {
        const config: DSQLConfig = { id: '   ', host: 'cluster.dsql.us-east-1.on.aws' };
        expect(() => validateDSQLConfig(config)).toThrow('DSQLStore: id must be provided and cannot be empty.');
      });

      it('should not throw for valid id', () => {
        expect(() => validateDSQLConfig(validConfig)).not.toThrow();
      });
    });

    describe('host validation', () => {
      it('should throw if host is missing', () => {
        const config = { id: 'test-store' } as DSQLConfig;
        expect(() => validateDSQLConfig(config)).toThrow('DSQLStore: host must be provided and cannot be empty.');
      });

      it('should throw if host is empty string', () => {
        const config: DSQLConfig = { id: 'test-store', host: '' };
        expect(() => validateDSQLConfig(config)).toThrow('DSQLStore: host must be provided and cannot be empty.');
      });

      it('should throw if host is whitespace only', () => {
        const config: DSQLConfig = { id: 'test-store', host: '   ' };
        expect(() => validateDSQLConfig(config)).toThrow('DSQLStore: host must be provided and cannot be empty.');
      });

      it('should not throw for valid host', () => {
        expect(() => validateDSQLConfig(validConfig)).not.toThrow();
      });
    });

    describe('maxLifetimeSeconds validation', () => {
      it('should throw if maxLifetimeSeconds is >= 3600', () => {
        const config: DSQLConfig = { ...validConfig, maxLifetimeSeconds: 3600 };
        expect(() => validateDSQLConfig(config)).toThrow(
          'DSQLStore: maxLifetimeSeconds must be less than 3600 (60 minutes) due to Aurora DSQL connection duration limit.',
        );
      });

      it('should throw if maxLifetimeSeconds is greater than 3600', () => {
        const config: DSQLConfig = { ...validConfig, maxLifetimeSeconds: 7200 };
        expect(() => validateDSQLConfig(config)).toThrow(
          'DSQLStore: maxLifetimeSeconds must be less than 3600 (60 minutes) due to Aurora DSQL connection duration limit.',
        );
      });

      it('should not throw if maxLifetimeSeconds is less than 3600', () => {
        const config: DSQLConfig = { ...validConfig, maxLifetimeSeconds: 3599 };
        expect(() => validateDSQLConfig(config)).not.toThrow();
      });

      it('should not throw if maxLifetimeSeconds is undefined', () => {
        expect(() => validateDSQLConfig(validConfig)).not.toThrow();
      });
    });

    describe('valid configurations', () => {
      it('should accept minimal valid config', () => {
        expect(() => validateDSQLConfig(validConfig)).not.toThrow();
      });

      it('should accept config with all optional fields', () => {
        const config: DSQLConfig = {
          id: 'full-config-store',
          host: 'cluster.dsql.ap-northeast-1.on.aws',
          user: 'custom-user',
          database: 'mydb',
          region: 'ap-northeast-1',
          schemaName: 'custom_schema',
          max: 20,
          min: 5,
          idleTimeoutMillis: 300000,
          maxLifetimeSeconds: 1800,
          connectionTimeoutMillis: 10000,
          allowExitOnIdle: false,
        };
        expect(() => validateDSQLConfig(config)).not.toThrow();
      });
    });
  });

  describe('extractRegionFromHost', () => {
    it('should extract region from valid DSQL endpoint', () => {
      expect(extractRegionFromHost('abc123.dsql.us-east-1.on.aws')).toBe('us-east-1');
    });

    it('should extract region from ap-northeast-1 endpoint', () => {
      expect(extractRegionFromHost('cluster-id.dsql.ap-northeast-1.on.aws')).toBe('ap-northeast-1');
    });

    it('should extract region from eu-west-1 endpoint', () => {
      expect(extractRegionFromHost('my-cluster.dsql.eu-west-1.on.aws')).toBe('eu-west-1');
    });

    it('should return undefined for non-DSQL host', () => {
      expect(extractRegionFromHost('localhost')).toBeUndefined();
    });

    it('should return undefined for standard RDS endpoint', () => {
      expect(extractRegionFromHost('mydb.abc123.us-east-1.rds.amazonaws.com')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(extractRegionFromHost('')).toBeUndefined();
    });

    it('should return undefined for malformed DSQL endpoint', () => {
      expect(extractRegionFromHost('cluster.dsql.on.aws')).toBeUndefined();
    });
  });

  describe('getEffectiveRegion', () => {
    it('should return explicit region when provided', () => {
      const config: DSQLConfig = {
        id: 'test-store',
        host: 'cluster.dsql.us-east-1.on.aws',
        region: 'eu-west-1',
      };
      expect(getEffectiveRegion(config)).toBe('eu-west-1');
    });

    it('should extract region from host when region not provided', () => {
      const config: DSQLConfig = {
        id: 'test-store',
        host: 'cluster.dsql.ap-northeast-1.on.aws',
      };
      expect(getEffectiveRegion(config)).toBe('ap-northeast-1');
    });

    it('should prefer explicit region over extracted region', () => {
      const config: DSQLConfig = {
        id: 'test-store',
        host: 'cluster.dsql.us-east-1.on.aws',
        region: 'ap-southeast-2',
      };
      expect(getEffectiveRegion(config)).toBe('ap-southeast-2');
    });

    it('should throw when region cannot be determined', () => {
      const config: DSQLConfig = {
        id: 'test-store',
        host: 'localhost',
      };
      expect(() => getEffectiveRegion(config)).toThrow(
        'DSQLStore: region could not be determined. Provide region in config or use a standard DSQL endpoint.',
      );
    });
  });

  describe('DSQL_POOL_DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(DSQL_POOL_DEFAULTS.max).toBe(10);
      expect(DSQL_POOL_DEFAULTS.min).toBe(0);
      expect(DSQL_POOL_DEFAULTS.idleTimeoutMillis).toBe(600000);
      expect(DSQL_POOL_DEFAULTS.maxLifetimeSeconds).toBe(3300);
      expect(DSQL_POOL_DEFAULTS.connectionTimeoutMillis).toBe(5000);
      expect(DSQL_POOL_DEFAULTS.allowExitOnIdle).toBe(true);
    });

    it('should have maxLifetimeSeconds less than 3600 (60 minutes)', () => {
      expect(DSQL_POOL_DEFAULTS.maxLifetimeSeconds).toBeLessThan(3600);
    });
  });
});
