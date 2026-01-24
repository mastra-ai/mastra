import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context.js';
import { MockAuthProvider } from '../../setup/mock-auth.js';
import { createUserData, uniqueEmail } from '../../fixtures/factories.js';

describe('Authentication Integration Tests', () => {
  let ctx: TestContext;
  let mockAuth: MockAuthProvider;

  beforeAll(async () => {
    ctx = await createTestContext();
    mockAuth = new MockAuthProvider();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('User Registration Flow', () => {
    it('should create a new user', async () => {
      const userData = createUserData();
      const user = await ctx.storage.createUser(userData);

      expect(user.id).toBe(userData.id);
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should retrieve user by ID', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      const user = await ctx.storage.getUser(userData.id);
      expect(user).not.toBeNull();
      expect(user!.id).toBe(userData.id);
      expect(user!.email).toBe(userData.email);
    });

    it('should retrieve user by email', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      const user = await ctx.storage.getUserByEmail(userData.email);
      expect(user).not.toBeNull();
      expect(user!.email).toBe(userData.email);
    });

    it('should retrieve user by email case-insensitively', async () => {
      const userData = createUserData({
        email: 'TestUser@EXAMPLE.com',
      });
      await ctx.storage.createUser(userData);

      const user = await ctx.storage.getUserByEmail('testuser@example.com');
      expect(user).not.toBeNull();
      expect(user!.id).toBe(userData.id);
    });

    it('should return null for non-existent user by ID', async () => {
      const user = await ctx.storage.getUser('non-existent-id');
      expect(user).toBeNull();
    });

    it('should return null for non-existent user by email', async () => {
      const user = await ctx.storage.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should prevent duplicate email registration', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      const duplicateUser = { ...createUserData(), email: userData.email };
      await expect(ctx.storage.createUser(duplicateUser)).rejects.toThrow(/email/i);
    });

    it('should update user information', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      const updatedUser = await ctx.storage.updateUser(userData.id, {
        name: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.avatarUrl).toBe('https://example.com/avatar.png');
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(updatedUser.createdAt.getTime());
    });

    it('should update user email and maintain email lookup', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      const newEmail = uniqueEmail();
      await ctx.storage.updateUser(userData.id, { email: newEmail });

      // Should find by new email
      const userByNewEmail = await ctx.storage.getUserByEmail(newEmail);
      expect(userByNewEmail).not.toBeNull();
      expect(userByNewEmail!.id).toBe(userData.id);

      // Should not find by old email
      const userByOldEmail = await ctx.storage.getUserByEmail(userData.email);
      expect(userByOldEmail).toBeNull();
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token format', async () => {
      const userData = createUserData();
      mockAuth.registerUser({
        id: userData.id,
        email: userData.email,
        name: userData.name ?? 'Test User',
      });

      const token = mockAuth.createToken(userData.id);
      const result = await mockAuth.validateToken(token);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userData.id);
    });

    it('should reject invalid token format', async () => {
      const result = await mockAuth.validateToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should reject token for non-registered user', async () => {
      const result = await mockAuth.validateToken('test-unknown-user');
      expect(result).toBeNull();
    });

    it('should reject empty token', async () => {
      const result = await mockAuth.validateToken('');
      expect(result).toBeNull();
    });

    it('should handle token with correct prefix but no user ID', async () => {
      const result = await mockAuth.validateToken('test-');
      expect(result).toBeNull();
    });
  });

  describe('Mock Auth Provider User Management', () => {
    it('should register and retrieve multiple users', async () => {
      const users = [
        { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        { id: 'user-2', email: 'user2@example.com', name: 'User 2' },
        { id: 'user-3', email: 'user3@example.com', name: 'User 3' },
      ];

      mockAuth.registerUsers(users);

      for (const user of users) {
        expect(mockAuth.hasUser(user.id)).toBe(true);
        const retrieved = await mockAuth.getUser(user.id);
        expect(retrieved).toEqual(user);
      }
    });

    it('should clear all users', async () => {
      mockAuth.registerUser({ id: 'temp-user', email: 'temp@example.com', name: 'Temp' });
      expect(mockAuth.hasUser('temp-user')).toBe(true);

      mockAuth.clear();
      expect(mockAuth.hasUser('temp-user')).toBe(false);
      expect(mockAuth.getAllUsers()).toHaveLength(0);
    });

    it('should return null for non-existent user', async () => {
      const user = await mockAuth.getUser('non-existent');
      expect(user).toBeNull();
    });
  });
});
