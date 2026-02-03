---
name: code-review
description: Provides structured code review guidelines for TypeScript projects. Use when reviewing pull requests, analyzing code quality, or suggesting improvements.
license: MIT
---

# Code Review Guidelines

## Overview

This skill provides structured guidelines for reviewing TypeScript code. Apply these standards when reviewing pull requests, analyzing code quality, or suggesting improvements.

**Keywords**: code review, pull request, PR review, TypeScript, code quality, best practices, refactoring

## Review Checklist

### 1. Code Correctness

**Before approving, verify:**

- [ ] Logic is correct and handles edge cases
- [ ] Error handling is appropriate
- [ ] No obvious bugs or race conditions
- [ ] Tests cover the changes adequately

### 2. Code Quality

**Check for:**

- [ ] Clear, descriptive variable and function names
- [ ] Functions do one thing well (single responsibility)
- [ ] No excessive nesting (max 3 levels)
- [ ] DRY - no unnecessary duplication
- [ ] YAGNI - no speculative features

### 3. TypeScript Specific

**Ensure:**

- [ ] Proper type annotations (avoid `any`)
- [ ] Interfaces/types defined for complex objects
- [ ] Generics used appropriately
- [ ] Null/undefined handled safely
- [ ] `strict` mode compatible

### 4. Performance

**Look for:**

- [ ] Unnecessary re-renders (React)
- [ ] Missing memoization for expensive operations
- [ ] Inefficient loops or data structures
- [ ] Memory leaks (event listeners, subscriptions)

## Review Comments

### Comment Format

Use this format for review comments:

```
[severity]: brief description

Why: explanation of the issue
Suggestion: how to fix it (with code if helpful)
```

**Severity levels:**

- `[critical]` - Must fix before merge
- `[suggestion]` - Recommended improvement
- `[nit]` - Minor style preference
- `[question]` - Need clarification

### Example Comments

**Good comment:**

```
[suggestion]: Consider extracting this validation logic

Why: This 15-line validation block is hard to test in isolation
Suggestion: Move to a `validateUserInput(data)` function
```

**Bad comment:**

```
This is wrong, fix it.
```

## Common Issues

### Anti-patterns to Flag

1. **God functions** - Functions over 50 lines doing multiple things
2. **Prop drilling** - Passing props through 3+ component levels
3. **Magic numbers** - Unexplained literal values
4. **Catch-all error handling** - `catch(e) { console.log(e) }`
5. **Implicit any** - Missing type annotations on function parameters

### Security Concerns

Always flag:

- SQL/NoSQL injection vulnerabilities
- XSS opportunities (unsanitized user input in DOM)
- Hardcoded secrets or API keys
- Insecure randomness for security contexts
- Missing input validation on API endpoints

## Approval Guidelines

### Approve When

- All critical issues resolved
- Tests pass
- Code meets team standards
- No security concerns

### Request Changes When

- Critical bugs found
- Security vulnerabilities present
- Missing required tests
- Significant performance issues

### Leave Comments When

- Minor improvements possible
- Design alternatives worth discussing
- Documentation could be clearer
