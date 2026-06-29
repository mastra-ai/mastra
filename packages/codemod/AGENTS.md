Codemod package guidance

Start with .claude/skills/codemod-patterns/SKILL.md for full workflow patterns examples and utility usage
If your agent runtime supports package-local skills load that skill first
If not read the file directly

Defaults
Use migration guide examples only
Include positive and negative fixtures
Run failing test before implementation
Prefer shared utils in src/codemods/lib/utils.ts
Minimize AST traversals combine passes use early returns
Verify with package-local tests only

Common flow
cd packages/codemod
pnpm scaffold <codemod-name>
pnpm test <codemod-name>

Files scaffold creates
src/codemods/v1/<codemod-name>.ts
src/test/<codemod-name>.test.ts
`src/test/__fixtures__/<codemod-name>.input.ts`
`src/test/__fixtures__/<codemod-name>.output.ts`

If you need implementation patterns method renames import rewrites property transforms or fixture templates read .claude/skills/codemod-patterns/SKILL.md
