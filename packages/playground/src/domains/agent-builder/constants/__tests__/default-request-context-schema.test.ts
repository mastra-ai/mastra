import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA } from '../default-request-context-schema';

describe('DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA', () => {
  it('exposes a single `user` request-context variable', () => {
    expect(DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA.type).toBe('object');
    expect(Object.keys(DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA.properties)).toEqual(['user', 'required']);
  });

  it('mirrors the CurrentUser shape with id required', () => {
    const user = DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA.properties.user;
    expect(user.type).toEqual('object');
    // Properties must exactly match the keys exposed by CurrentUser. If CurrentUser
    // gains or loses a field, update both the type and this constant.
    expect(Object.keys(user.properties).sort()).toEqual(
      ['avatarUrl', 'email', 'id', 'name', 'permissions', 'roles'].sort(),
    );
    expect(user.required).toEqual(['id']);
  });
});
