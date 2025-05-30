import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthFirebase } from './index';

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
    credential: {
      cert: vi.fn(() => 'mock-credential'),
      applicationDefault: vi.fn(() => 'mock-default-credential'),
    },
  },
}));

// Mock Firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(),
    })),
  })),
}));

describe('MastraAuthFirebase', () => {
  const mockServiceAccount = 'mock-service-account';
  const mockDatabaseId = 'mock-database-id';
  const mockToken = 'mock-token';
  const mockUserId = 'mock-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with provided options', () => {
      const auth = new MastraAuthFirebase({
        serviceAccount: mockServiceAccount,
        databaseId: mockDatabaseId,
      });

      expect(auth).toBeInstanceOf(MastraAuthFirebase);
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: 'mock-credential',
      });
      expect(admin.credential.cert).toHaveBeenCalledWith(mockServiceAccount);
    });

    it('should initialize with environment variables', () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = mockServiceAccount;
      process.env.FIRESTORE_DATABASE_ID = mockDatabaseId;

      const auth = new MastraAuthFirebase();

      expect(auth).toBeInstanceOf(MastraAuthFirebase);
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: 'mock-credential',
      });
      expect(admin.credential.cert).toHaveBeenCalledWith(mockServiceAccount);

      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.FIRESTORE_DATABASE_ID;
    });
  });

  describe('authenticateToken', () => {
    it('should verify and return decoded token', async () => {
      const mockDecodedToken = { uid: mockUserId };
      const mockVerifyIdToken = vi.fn().mockResolvedValue(mockDecodedToken);

      (admin.auth as any).mockReturnValue({
        verifyIdToken: mockVerifyIdToken,
      });

      const auth = new MastraAuthFirebase();
      const result = await auth.authenticateToken(mockToken);

      expect(mockVerifyIdToken).toHaveBeenCalledWith(mockToken);
      expect(result).toEqual(mockDecodedToken);
    });

    it('should return null when token verification fails', async () => {
      const mockVerifyIdToken = vi.fn().mockRejectedValue(new Error('Invalid token'));

      (admin.auth as any).mockReturnValue({
        verifyIdToken: mockVerifyIdToken,
      });

      const auth = new MastraAuthFirebase();
      const result = await auth.authenticateToken(mockToken).catch(() => null);

      expect(mockVerifyIdToken).toHaveBeenCalledWith(mockToken);
      expect(result).toBeNull();
    });
  });

  describe('authorizeUser', () => {
    it('should return true when user has access', async () => {
      const mockUser = { uid: mockUserId };
      const mockUserAccessData = { someData: 'value' };
      const mockGet = vi.fn().mockResolvedValue({ data: () => mockUserAccessData });
      const mockDoc = vi.fn().mockReturnValue({ get: mockGet });

      (getFirestore as any).mockReturnValue({
        doc: mockDoc,
      });

      const auth = new MastraAuthFirebase();
      const result = await auth.authorizeUser(mockUser as any);

      expect(mockDoc).toHaveBeenCalledWith(`/user_access/${mockUserId}`);
      expect(result).toBe(true);
    });

    it('should return false when user has no access', async () => {
      const mockUser = { uid: mockUserId };
      const mockGet = vi.fn().mockResolvedValue({ data: () => null });
      const mockDoc = vi.fn().mockReturnValue({ get: mockGet });

      (getFirestore as any).mockReturnValue({
        doc: mockDoc,
      });

      const auth = new MastraAuthFirebase();
      const result = await auth.authorizeUser(mockUser as any);

      expect(mockDoc).toHaveBeenCalledWith(`/user_access/${mockUserId}`);
      expect(result).toBe(false);
    });
  });

  it('can be overridden with custom authorization logic', async () => {
    const firebase = new MastraAuthFirebase({
      async authorizeUser(user: any): Promise<boolean> {
        // Custom authorization logic that checks for specific permissions
        return user?.permissions?.includes('admin') ?? false;
      },
    });

    // Test with admin user
    const adminUser = { sub: 'user123', permissions: ['admin'] } as unknown as DecodedIdToken;
    expect(await firebase.authorizeUser(adminUser)).toBe(true);

    // Test with non-admin user
    const regularUser = { sub: 'user456', permissions: ['read'] };
    expect(await firebase.authorizeUser(regularUser)).toBe(false);

    // Test with user without permissions
    const noPermissionsUser = { sub: 'user789' };
    expect(await firebase.authorizeUser(noPermissionsUser)).toBe(false);
  });
});
