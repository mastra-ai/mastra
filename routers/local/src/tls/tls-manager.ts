import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Configuration for TLSManager.
 */
export interface TLSManagerConfig {
  /**
   * Directory to store certificates.
   * @default '~/.mastra/certs'
   */
  certDir?: string;

  /**
   * Certificate validity in days.
   * @default 365
   */
  validityDays?: number;

  /**
   * Organization name for the certificate.
   * @default 'Mastra Local Development'
   */
  organization?: string;

  /**
   * Enable console logging.
   * @default true
   */
  logChanges?: boolean;
}

/**
 * Certificate and key pair.
 */
export interface CertificatePair {
  cert: string;
  key: string;
  domain: string;
  expiresAt: Date;
}

/**
 * Result of certificate generation.
 */
export interface CertGenerationResult {
  success: boolean;
  certificate?: CertificatePair;
  error?: string;
}

/**
 * Stored certificate metadata.
 */
interface CertificateMetadata {
  domain: string;
  createdAt: string;
  expiresAt: string;
  validityDays: number;
}

/**
 * Manages self-signed TLS certificates for local HTTPS development.
 *
 * Uses the `selfsigned` package to generate certificates. If not installed,
 * an error will be thrown when trying to generate certificates.
 *
 * @example
 * ```typescript
 * const tls = new TLSManager({
 *   certDir: '~/.mastra/certs',
 *   validityDays: 365,
 * });
 *
 * // Generate certificate for a domain
 * const result = await tls.getCertificate('mastra.local');
 * if (result.success) {
 *   // Use result.certificate.cert and result.certificate.key
 *   // for HTTPS server configuration
 * }
 *
 * // Certificates are cached and reused until they expire
 * const cached = await tls.getCertificate('mastra.local');
 * ```
 */
// Type for selfsigned module
interface SelfsignedModule {
  generate: (
    attrs: Array<{ name: string; value: string }>,
    options?: {
      keySize?: number;
      days?: number;
      algorithm?: string;
      extensions?: Array<{ name: string; [key: string]: unknown }>;
    },
  ) => { cert: string; private: string; public: string };
}

export class TLSManager {
  private readonly config: Required<TLSManagerConfig>;
  private selfsigned: SelfsignedModule | null = null;
  private readonly certCache: Map<string, CertificatePair> = new Map();

  constructor(config: TLSManagerConfig = {}) {
    this.config = {
      certDir: config.certDir ?? join(homedir(), '.mastra', 'certs'),
      validityDays: config.validityDays ?? 365,
      organization: config.organization ?? 'Mastra Local Development',
      logChanges: config.logChanges ?? true,
    };
  }

  /**
   * Get or generate a certificate for a domain.
   * Certificates are cached in memory and on disk.
   */
  async getCertificate(domain: string): Promise<CertGenerationResult> {
    // Check in-memory cache first
    const cached = this.certCache.get(domain);
    if (cached && !this.isExpired(cached)) {
      return { success: true, certificate: cached };
    }

    // Check disk cache
    const fromDisk = await this.loadFromDisk(domain);
    if (fromDisk && !this.isExpired(fromDisk)) {
      this.certCache.set(domain, fromDisk);
      return { success: true, certificate: fromDisk };
    }

    // Generate new certificate
    return this.generateCertificate(domain);
  }

  /**
   * Generate a new certificate for a domain.
   */
  async generateCertificate(domain: string): Promise<CertGenerationResult> {
    try {
      // Dynamically import selfsigned
      if (!this.selfsigned) {
        try {
          this.selfsigned = await import('selfsigned');
        } catch {
          return {
            success: false,
            error:
              'selfsigned is not installed. Install it with: npm install selfsigned\n' +
              'This is an optional dependency for local TLS support.',
          };
        }
      }

      // Generate certificate with proper attributes
      const attrs = [
        { name: 'commonName', value: domain },
        { name: 'organizationName', value: this.config.organization },
      ];

      const extensions = [
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: domain }, // DNS name
            { type: 2, value: `*.${domain}` }, // Wildcard
            { type: 7, ip: '127.0.0.1' }, // IPv4 localhost
            { type: 7, ip: '::1' }, // IPv6 localhost
          ],
        },
        {
          name: 'basicConstraints',
          cA: true,
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          keyEncipherment: true,
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
        },
      ];

      const pems = this.selfsigned.generate(attrs, {
        keySize: 2048,
        days: this.config.validityDays,
        algorithm: 'sha256',
        extensions,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.validityDays);

      const certificate: CertificatePair = {
        cert: pems.cert,
        key: pems.private,
        domain,
        expiresAt,
      };

      // Save to disk
      await this.saveToDisk(domain, certificate);

      // Cache in memory
      this.certCache.set(domain, certificate);

      if (this.config.logChanges) {
        console.info(`[TLSManager] Generated certificate for: ${domain}`);
      }

      return { success: true, certificate };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Delete a certificate for a domain.
   */
  async deleteCertificate(domain: string): Promise<boolean> {
    // Check if certificate exists anywhere
    const wasInCache = this.certCache.has(domain);
    const certPath = this.getCertPath(domain);
    const keyPath = this.getKeyPath(domain);
    const metaPath = this.getMetaPath(domain);

    const existsOnDisk = existsSync(certPath) || existsSync(keyPath) || existsSync(metaPath);

    // If certificate doesn't exist anywhere, return false
    if (!wasInCache && !existsOnDisk) {
      return false;
    }

    // Remove from memory cache
    this.certCache.delete(domain);

    try {
      // Remove from disk
      if (existsSync(certPath)) await unlink(certPath);
      if (existsSync(keyPath)) await unlink(keyPath);
      if (existsSync(metaPath)) await unlink(metaPath);

      if (this.config.logChanges) {
        console.info(`[TLSManager] Deleted certificate for: ${domain}`);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all cached certificates.
   */
  async clearCertificates(): Promise<void> {
    // Get all domains from disk
    const domains = await this.listCertificates();

    // Delete each certificate
    for (const domain of domains) {
      await this.deleteCertificate(domain);
    }

    // Clear memory cache
    this.certCache.clear();

    if (this.config.logChanges) {
      console.info('[TLSManager] All certificates cleared');
    }
  }

  /**
   * List all stored certificate domains.
   */
  async listCertificates(): Promise<string[]> {
    if (!existsSync(this.config.certDir)) {
      return [];
    }

    const { readdir } = await import('node:fs/promises');
    const files = await readdir(this.config.certDir);

    // Find .meta.json files and extract domain names
    const domains: string[] = [];
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const domain = file.replace('.meta.json', '');
        domains.push(domain);
      }
    }

    return domains;
  }

  /**
   * Check if a certificate exists for a domain.
   */
  async hasCertificate(domain: string): Promise<boolean> {
    // Check memory cache
    if (this.certCache.has(domain)) {
      return true;
    }

    // Check disk
    const certPath = this.getCertPath(domain);
    return existsSync(certPath);
  }

  /**
   * Get trust instructions for the user's platform.
   */
  getTrustInstructions(domain: string): string {
    const certPath = this.getCertPath(domain);

    const instructions = `
To trust the self-signed certificate for ${domain}:

macOS:
  1. Open Keychain Access
  2. Import the certificate: ${certPath}
  3. Double-click the imported certificate
  4. Expand "Trust" and set "When using this certificate" to "Always Trust"

Linux (Ubuntu/Debian):
  sudo cp ${certPath} /usr/local/share/ca-certificates/${domain}.crt
  sudo update-ca-certificates

Linux (Fedora/RHEL):
  sudo cp ${certPath} /etc/pki/ca-trust/source/anchors/${domain}.crt
  sudo update-ca-trust

Windows:
  1. Run: certutil -addstore -f "ROOT" "${certPath}"
  2. Or: Import via Certificate Manager (certmgr.msc)

Browser (Chrome/Firefox):
  - Chrome: Settings > Privacy > Security > Manage certificates > Authorities > Import
  - Firefox: Settings > Privacy & Security > Certificates > View Certificates > Import
`.trim();

    return instructions;
  }

  /**
   * Get the certificate directory.
   */
  getCertDir(): string {
    return this.config.certDir;
  }

  /**
   * Check if a certificate is expired.
   */
  private isExpired(cert: CertificatePair): boolean {
    return cert.expiresAt.getTime() < Date.now();
  }

  /**
   * Load a certificate from disk.
   */
  private async loadFromDisk(domain: string): Promise<CertificatePair | null> {
    const certPath = this.getCertPath(domain);
    const keyPath = this.getKeyPath(domain);
    const metaPath = this.getMetaPath(domain);

    if (!existsSync(certPath) || !existsSync(keyPath) || !existsSync(metaPath)) {
      return null;
    }

    try {
      const [cert, key, metaJson] = await Promise.all([
        readFile(certPath, 'utf-8'),
        readFile(keyPath, 'utf-8'),
        readFile(metaPath, 'utf-8'),
      ]);

      const meta: CertificateMetadata = JSON.parse(metaJson);

      return {
        cert,
        key,
        domain: meta.domain,
        expiresAt: new Date(meta.expiresAt),
      };
    } catch {
      return null;
    }
  }

  /**
   * Save a certificate to disk.
   */
  private async saveToDisk(domain: string, cert: CertificatePair): Promise<void> {
    // Ensure directory exists
    await mkdir(this.config.certDir, { recursive: true });

    const certPath = this.getCertPath(domain);
    const keyPath = this.getKeyPath(domain);
    const metaPath = this.getMetaPath(domain);

    const metadata: CertificateMetadata = {
      domain,
      createdAt: new Date().toISOString(),
      expiresAt: cert.expiresAt.toISOString(),
      validityDays: this.config.validityDays,
    };

    await Promise.all([
      writeFile(certPath, cert.cert, 'utf-8'),
      writeFile(keyPath, cert.key, { mode: 0o600, encoding: 'utf-8' }), // Restrictive permissions for key
      writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8'),
    ]);
  }

  /**
   * Get the path for a certificate file.
   */
  private getCertPath(domain: string): string {
    // Sanitize domain name for filesystem
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    return join(this.config.certDir, `${safeDomain}.crt`);
  }

  /**
   * Get the path for a private key file.
   */
  private getKeyPath(domain: string): string {
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    return join(this.config.certDir, `${safeDomain}.key`);
  }

  /**
   * Get the path for a metadata file.
   */
  private getMetaPath(domain: string): string {
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    return join(this.config.certDir, `${safeDomain}.meta.json`);
  }
}
