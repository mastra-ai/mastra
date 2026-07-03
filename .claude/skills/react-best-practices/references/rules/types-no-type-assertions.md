---
title: No `as` Type Assertions (Including Tests)
impact: HIGH
impactDescription: `as` casts silence the type checker and hide real shape mismatches, in production and test code alike
tags: types, typescript, as, casts, assertions, test-quality
---

## No `as` Type Assertions (Including Tests)

Never use `as` type assertions (`x as T`, `x as unknown as T`, `x as any`). They tell
the compiler to stop checking, so a wrong shape passes silently until it breaks at
runtime. This applies **in tests too** — test fixtures and DOM lookups are exactly
where a silent shape drift goes unnoticed. `as const` is fine (it narrows, it does
not assert a type).

**Why this matters:**

- An `as` cast is an unchecked claim; refactors that change the real type won't flag the cast site.
- Test casts (`getByX(...) as HTMLInputElement`, `{...} as SomeMessage`) hide fixture drift and make tests assert against a shape the code no longer produces.
- Every cast is a place a `null`, a missing field, or a wrong union member can slip through.

**Use instead:**

- **Type guards** with a predicate return (`value is T`) to narrow `unknown`/loose values.
- **Generic type arguments** on APIs that accept them (`querySelector<HTMLElement>(…)`, `screen.getByRole<HTMLTextAreaElement>(…)`, `closest<HTMLFormElement>(…)`).
- **Typed factories / annotated locals** for fixtures, so the object is checked against the target type.
- **`implements`** on class mocks so the instance genuinely satisfies the interface.
- **`satisfies`** when you want inference kept but the value validated against a type.

**Incorrect:**

```ts
// Production: silences a real union/shape mismatch
const metadata = message.content.metadata as MessageMetadata | undefined;
return { ...message, role: 'assistant', content } as MastraDBMessage;

// Tests: fixture and DOM casts hide drift
const msg = { id, role: 'signal', content } as MastraDBMessage;
const textarea = screen.getByPlaceholderText('Message') as HTMLTextAreaElement;
const el = document.querySelector('[data-x]') as HTMLElement;
this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
```

**Correct:**

```ts
// Production: narrow with a guard, or annotate the built object
const isMessageMetadata = (v: unknown): v is MessageMetadata => typeof v === 'object' && v !== null;
const metadata = isMessageMetadata(message.content.metadata) ? message.content.metadata : undefined;
const parts: MastraDBMessage['content']['parts'] = [{ type: 'data-signal', data }];
return { ...message, role: 'assistant', content: { ...message.content, parts } };

// Tests: typed factory, query generics, guards, and `implements`
const signalMessage = (id: string, type: string): MastraDBMessage => ({ id, role: 'signal', type, createdAt: new Date(), content: { format: 2, parts: [] } });
const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Message');
const el = document.querySelector<HTMLElement>('[data-x]');
if (!el) throw new Error('missing element');
class MockIO implements IntersectionObserver { /* real members */ }
```

**Reviewer smell:** any ` as ` in a diff (except `as const`). A cast in a test is not
a shortcut — it is the same defect as a cast in production, in the one place no one
looks.
