# Security Checklist

## Quick Reference

### Input Handling

- [ ] All user input is validated before use
- [ ] SQL queries use parameterized statements
- [ ] File paths are validated and sandboxed
- [ ] HTML output is escaped/sanitized
- [ ] Shell commands don't include user input directly

### Authentication

- [ ] All sensitive endpoints require authentication
- [ ] Tokens have appropriate expiry times
- [ ] Failed auth attempts are rate-limited
- [ ] Session tokens are invalidated on logout
- [ ] Password hashing uses bcrypt/scrypt/argon2

### Data Protection

- [ ] No secrets in source code
- [ ] Sensitive data is encrypted at rest
- [ ] PII is not logged
- [ ] API responses don't over-expose data
- [ ] Error messages don't leak internal details

### Dependencies

- [ ] No known vulnerable dependencies
- [ ] Dependencies are pinned to specific versions
- [ ] Minimal dependency surface area

### HTTP Security

- [ ] CORS is configured restrictively
- [ ] Security headers are set (CSP, HSTS, X-Frame-Options)
- [ ] Cookies have Secure, HttpOnly, SameSite flags
- [ ] Rate limiting on public endpoints
