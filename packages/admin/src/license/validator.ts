import { createVerify } from 'node:crypto';

import { MastraAdminError } from '../errors';

import { getMergedFeatures, isFeatureEnabled, TIER_LIMITS } from './features';
import type { LicenseFeature, LicenseInfo, LicensePayload } from './types';
import { LicenseTier } from './types';

/**
 * Public key for verifying license signatures.
 * In production, this would be fetched from a secure source.
 */
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z
8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y
0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z
0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z
8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y
0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z0Z8Y0Z
0Z8Y0QIDAQAB
-----END PUBLIC KEY-----`;

/**
 * License validator for verifying and decoding license keys.
 */
export class LicenseValidator {
  private licenseInfo: LicenseInfo | null = null;
  private validated = false;

  constructor(
    private readonly licenseKey: string,
    private readonly publicKey: string = LICENSE_PUBLIC_KEY,
  ) {}

  /**
   * Validate and decode the license key.
   * Caches the result after first validation.
   */
  async validate(): Promise<LicenseInfo> {
    if (this.validated && this.licenseInfo) {
      return this.licenseInfo;
    }

    try {
      // For development, allow special dev license
      if (this.licenseKey === 'dev' || this.licenseKey === 'development') {
        this.licenseInfo = this.createDevLicense();
        this.validated = true;
        return this.licenseInfo;
      }

      // Decode and verify the license (JWT-like format)
      const payload = await this.verifyAndDecode(this.licenseKey);
      this.licenseInfo = this.payloadToLicenseInfo(payload);
      this.validated = true;

      // Check expiration
      if (this.licenseInfo.expiresAt && this.licenseInfo.expiresAt < new Date()) {
        this.licenseInfo.valid = false;
        throw MastraAdminError.licenseExpired(this.licenseInfo.expiresAt);
      }

      return this.licenseInfo;
    } catch (error) {
      if (error instanceof MastraAdminError) {
        throw error;
      }
      throw MastraAdminError.invalidLicense(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check if a specific feature is enabled.
   */
  hasFeature(feature: LicenseFeature): boolean {
    if (!this.licenseInfo) {
      return false;
    }
    return isFeatureEnabled(this.licenseInfo, feature);
  }

  /**
   * Check if a team can be created based on limits.
   */
  canCreateTeam(currentCount: number): boolean {
    if (!this.licenseInfo?.valid) {
      return false;
    }
    if (this.licenseInfo.maxTeams === null) {
      return true;
    }
    return currentCount < this.licenseInfo.maxTeams;
  }

  /**
   * Check if a team member can be added.
   */
  canAddTeamMember(_teamId: string, currentCount: number): boolean {
    if (!this.licenseInfo?.valid) {
      return false;
    }
    if (this.licenseInfo.maxUsersPerTeam === null) {
      return true;
    }
    return currentCount < this.licenseInfo.maxUsersPerTeam;
  }

  /**
   * Check if a project can be created.
   */
  canCreateProject(_teamId: string, currentCount: number): boolean {
    if (!this.licenseInfo?.valid) {
      return false;
    }
    if (this.licenseInfo.maxProjects === null) {
      return true;
    }
    return currentCount < this.licenseInfo.maxProjects;
  }

  /**
   * Get the cached license info.
   */
  getLicenseInfo(): LicenseInfo {
    if (!this.licenseInfo) {
      throw new Error('License not validated. Call validate() first.');
    }
    return this.licenseInfo;
  }

  /**
   * Get all enabled features.
   */
  getEnabledFeatures(): LicenseFeature[] {
    if (!this.licenseInfo) {
      return [];
    }
    return getMergedFeatures(this.licenseInfo);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async verifyAndDecode(licenseKey: string): Promise<LicensePayload> {
    // License format: base64(header).base64(payload).base64(signature)
    const parts = licenseKey.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid license format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const signedData = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64!, 'base64');

    // Verify signature
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signedData);
    const isValid = verifier.verify(this.publicKey, signature);

    if (!isValid) {
      throw new Error('Invalid license signature');
    }

    // Decode payload
    const payloadJson = Buffer.from(payloadB64!, 'base64').toString('utf8');
    return JSON.parse(payloadJson) as LicensePayload;
  }

  private payloadToLicenseInfo(payload: LicensePayload): LicenseInfo {
    const tier = payload.tier as LicenseTier;
    const limits = payload.limits ?? TIER_LIMITS[tier];

    return {
      valid: true,
      tier,
      features: payload.features ?? [],
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      maxTeams: limits?.teams ?? null,
      maxUsersPerTeam: limits?.usersPerTeam ?? null,
      maxProjects: limits?.projects ?? null,
      organizationName: payload.org,
      licenseKeyId: payload.kid,
    };
  }

  private createDevLicense(): LicenseInfo {
    return {
      valid: true,
      tier: LicenseTier.ENTERPRISE,
      features: Object.values(LicenseFeature) as LicenseFeature[],
      expiresAt: null,
      maxTeams: null,
      maxUsersPerTeam: null,
      maxProjects: null,
      organizationName: 'Development',
      licenseKeyId: 'dev',
    };
  }
}
