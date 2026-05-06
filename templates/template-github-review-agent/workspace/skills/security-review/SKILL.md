---
name: security-review
description: Security-focused code review checklist for identifying vulnerabilities
version: 1.0.0
metadata:
  tags:
    - code-review
    - security
---

# Security Review

When reviewing code for security issues, check each category below. Reference the detailed checklist in `references/security-checklist.md`.

## Injection Vulnerabilities

- SQL injection: Look for string concatenation in database queries
- Command injection: Check for unsanitized input passed to shell commands (`exec`, `spawn`)
- XSS: Look for unsanitized user input rendered in HTML/templates
- Path traversal: Check for user input in file paths without sanitization

## Authentication & Authorization

- Verify authentication checks on protected routes/endpoints
- Ensure authorization checks match the required access level
- Look for privilege escalation paths (e.g., user can modify other users' data)
- Check that password/token comparison uses constant-time comparison

## Secrets & Credentials

- Hardcoded API keys, passwords, tokens, or connection strings
- Secrets in configuration files that might be committed
- Sensitive data in logs or error messages
- Credentials passed via URL query parameters

## Input Validation

- Validate and sanitize all external input (user input, API responses, file contents)
- Check for missing or weak input validation on API endpoints
- Verify type coercion doesn't bypass validation
- Look for overly permissive CORS or CSP configurations

## Data Exposure

- Sensitive data returned in API responses unnecessarily
- PII or secrets in application logs
- Information leakage in error messages (stack traces, internal paths)
- Missing data encryption for sensitive fields

## Severity Levels

- 🔴 **CRITICAL**: Exploitable vulnerability (injection, auth bypass, exposed secrets)
- 🟠 **HIGH**: Potential vulnerability that needs investigation
- 🟡 **MEDIUM**: Security weakness or missing best practice
- 🔵 **LOW**: Minor security improvement suggestion
