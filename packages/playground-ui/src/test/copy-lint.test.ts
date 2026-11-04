import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { noTextLayoutSpacing, noTextSeparators } from '../../oxlint/copy-rules.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when copy follows the writing rules', run);
  if (name === 'invalid') return describe('when copy uses decorative separators or spacer text', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });

tester.run('no-text-separators', noTextSeparators, {
  valid: [
    { name: 'allows parentheses in version labels', code: 'const label = "v8 (current)";' },
    { name: 'allows ordinary punctuation', code: '<p>Not valid JSON: check the input. Try again.</p>;' },
    { name: 'allows entity notation in plain strings', code: 'const label = "Use &mdash; in HTML";' },
    { name: 'allows missing values', code: '<span>{value ?? "—"}</span>;' },
    { name: 'allows a bare placeholder', code: '<span>—</span>;' },
    { name: 'allows a literal missing-value expression', code: '<span>{"—"}</span>;' },
    {
      name: 'allows a nullish fallback inside concatenated copy',
      code: '<span>{name + (value ?? "—") + status}</span>;',
    },
    { name: 'allows a template containing only a placeholder', code: '<span>{`${"—"}`}</span>;' },
    { name: 'allows comments around a bare placeholder', code: '<span>{/* before */}—{/* after */}</span>;' },
    {
      name: 'allows a missing-value fallback between other values',
      code: '<span>{name}{value ?? "—"}{status}</span>;',
    },
    {
      name: 'allows a falsy fallback between other values',
      code: '<span>{name}{value || "—"}{status}</span>;',
    },
    { name: 'allows a hyphen placeholder', code: '<span>{value ?? "-"}</span>;' },
    { name: 'allows a minus sign before a number', code: 'const label = `${delta < 0 ? "-" : "+"}${value}`;' },
    { name: 'allows masked secrets', code: '<span>{`••••${key.slice(-4)}`}</span>;' },
    { name: 'allows hyphenated words and CLI flags', code: '<p>Pre-release builds use --tag next.</p>;' },
    {
      name: 'allows a separator in the browser tab title',
      code: 'useEffect(() => { document.title = `${title} | Mastra`; }, [title]);',
    },
    {
      name: 'allows a browser tab title bound before assignment',
      code: 'const pageTitle = `${title} | Mastra`; document.title = pageTitle;',
    },
    { name: 'allows a conditional placeholder', code: 'const label = present ? value : "—";' },
    { name: 'ignores CSS strings', code: '<div className="before:content-[\'·\']" />;' },
    { name: 'ignores CSS content assignments', code: 'style.content = "·";' },
    { name: 'ignores internal keys', code: 'const cacheKey = `${a}|${b}`;' },
    {
      name: 'ignores schema type notation',
      code: 'const typeLabel = types.join(" | "); <InlineCode>{typeLabel}</InlineCode>;',
    },
    {
      name: 'ignores a truthiness guard around technical content',
      code: 'const typeLabel = types.join(" | "); <p>{typeLabel && <InlineCode>{typeLabel}</InlineCode>}</p>;',
    },
    {
      name: 'ignores a conditional guard around technical content',
      code: 'const typeLabel = types.join(" | "); <p>{typeLabel ? <InlineCode>{typeLabel}</InlineCode> : null}</p>;',
    },
    { name: 'ignores code blocks', code: '<pre><code>command -- flag | output</code></pre>;' },
    { name: 'ignores Markdown source', code: '<MarkdownRenderer content="| Field | Value |" />;' },
    {
      name: 'ignores a binding used only as Markdown source',
      code: 'const content = "| Field | Value |"; <MarkdownRenderer content={content} />;',
    },
    {
      name: 'ignores agent prompts',
      code: 'const instructions = "Role — help the user"; <Textarea placeholder={instructions} />;',
    },
    { name: 'ignores tool descriptions', code: 'createTool({ description: "Call this — omit other fields" });' },
    { name: 'ignores separators inside inline code', code: '<InlineCode>a | b</InlineCode>;' },
    {
      name: 'ignores copy-named parameters of technical helpers',
      code: 'function cacheKey({ title, id }) { return `${id}|${title}`; }',
    },
  ],
  invalid: [
    {
      name: 'reports a pipe between header elements',
      code: '<header><span>{id}</span> | <nav /></header>;',
      errors: 1,
    },
    { name: 'reports a middot in rendered copy', code: '<p>Production · Connected</p>;', errors: 1 },
    { name: 'reports a prose em dash', code: '<p>Refresh failed — try again.</p>;', errors: 1 },
    { name: 'reports an em dash between rendered values', code: '<p>{label} — {description}</p>;', errors: 1 },
    { name: 'reports a literal separator expression', code: '<p>{name}{"—"}{status}</p>;', errors: 1 },
    {
      name: 'reports a separator in concatenated copy',
      code: '<span>{name + "—" + status}</span>;',
      errors: 1,
    },
    {
      name: 'reports a separator in concatenated literal copy',
      code: '<span>{"Name" + "—" + "status"}</span>;',
      errors: 1,
    },
    {
      name: 'reports a separator between consecutive concatenated literals',
      code: '<span>{name + " " + "—" + " " + status}</span>;',
      errors: 1,
    },
    {
      name: 'reports a locally bound separator expression',
      code: 'const separator = "—"; <p>{name}{separator}{status}</p>;',
      errors: 1,
    },
    {
      name: 'reports a conditional separator between values',
      code: '<p>{name}{visible ? "—" : ""}{status}</p>;',
      errors: 1,
    },
    {
      name: 'reports a guarded separator between values',
      code: '<p>{name}{visible && "—"}{status}</p>;',
      errors: 1,
    },
    {
      name: 'reports a concatenated separator between values',
      code: '<p>{name}{"" + "—"}{status}</p>;',
      errors: 1,
    },
    {
      name: 'reports an array separator between values',
      code: '<p>{name}{["—"]}{status}</p>;',
      errors: 1,
    },
    {
      name: 'reports a separator interpolated between values',
      code: '<p>{`${name}${"—"}${status}`}</p>;',
      errors: 1,
    },
    {
      name: 'reports a mapped separator between values',
      code: '<p>{name}{items.map(() => "—")}{status}</p>;',
      errors: 1,
    },
    {
      name: 'reports a joined separator between values',
      code: '<p>{name}{["—"].join("")}{status}</p>;',
      errors: 1,
    },
    { name: 'reports double-hyphen prose separators', code: '<p>Refresh failed -- try again.</p>;', errors: 1 },
    { name: 'reports copy props', code: '<Button aria-label="Name — details" />;', errors: 1 },
    { name: 'reports a spaced bullet before a value', code: '<p>• {threadTitle}</p>;', errors: 1 },
    { name: 'reports a spaced hyphen between values', code: 'const label = `v${n} - ${date}`;', errors: 1 },
    { name: 'reports a spaced hyphen between rendered values', code: '<p>{name} - {status}</p>;', errors: 1 },
    {
      name: 'reports visible attachment type labels',
      code: '<AttachmentCard typeLabel="PNG · unavailable" />;',
      errors: 1,
    },
    { name: 'reports object metadata', code: 'const item = { meta: `${author} · ${time}` };', errors: 1 },
    { name: 'reports label helpers', code: 'function versionLabel(v) { return `v${v} · current`; }', errors: 1 },
    {
      name: 'follows a locally rendered binding',
      code: 'const extra = "Private · GitHub"; <span>{extra}</span>;',
      errors: 1,
    },
    {
      name: 'follows a locally rendered helper',
      code: 'function information() { return "Private · GitHub"; } <span>{information()}</span>;',
      errors: 1,
    },
    { name: 'reports join separators in UI labels', code: 'const label = names.join(" · ");', errors: 1 },
    { name: 'reports em dash join separators', code: 'const title = names.join(" — ");', errors: 1 },
    { name: 'reports a fallback join separator', code: 'const label = names.join(delimiter ?? "—");', errors: 1 },
    {
      name: 'reports a browser tab title that is also rendered',
      code: 'const pageTitle = `${title} | Mastra`; document.title = pageTitle; <h1>{pageTitle}</h1>;',
      errors: 1,
    },
    { name: 'reports interpolated em dash separators', code: 'const title = `${name} — ${detail}`;', errors: 1 },
    { name: 'reports an interpolated prefix separator', code: 'const label = `— ${name}`;', errors: 1 },
    {
      name: 'reports a shared literal once',
      code: 'const label = "Private · GitHub"; <span>{label}</span>;',
      errors: 1,
    },
    {
      name: 'reports guarded copy that is rendered as text',
      code: 'const label = "Private · GitHub"; <p>{label && <span>{label}</span>}</p>;',
      errors: 1,
    },
    { name: 'reports toast instructions', code: 'toast.error("Refresh failed — try again.");', errors: 1 },
    {
      name: 'reports only rendered branches',
      code: '<p>{kind === "a | b" ? "Private · GitHub" : name}</p>;',
      errors: 1,
    },
  ],
});

tester.run('no-text-layout-spacing', noTextLayoutSpacing, {
  valid: [
    { name: 'allows single word spaces', code: '<p>Choose a model</p>;' },
    { name: 'allows entity notation in plain strings', code: '<span>{"Name&nbsp;&nbsp;Status"}</span>;' },
    { name: 'allows multiline JSX indentation', code: '<p>\n  Choose a model\n  for this session\n</p>;' },
    {
      name: 'allows source indentation around children',
      code: '<p>\n  <span>Name</span>\n  <span>Status</span>\n</p>;',
    },
    { name: 'allows spaces in code examples', code: '<CodeBlock>{"const x =  1;"}</CodeBlock>;' },
    { name: 'allows preformatted content', code: '<pre>Column A  Column B</pre>;' },
    {
      name: 'allows a binding used only as preformatted content',
      code: 'const description = "Column A  Column B"; <pre>{description}</pre>;',
    },
    { name: 'allows a single NBSP placeholder', code: '<span>{"\\u00a0"}</span>;' },
    {
      name: 'allows source indentation in template prose',
      code: 'const description = `Choose a model.\n  It can be changed later.`;',
    },
    { name: 'ignores command output alignment', code: 'const commandOutput = "Name  Status"; toast(commandOutput);' },
  ],
  invalid: [
    {
      name: 'reports spaces used between version and date',
      code: 'function formatVersionLabel(v, date) { return `v${v}  ${date}`; }',
      errors: 1,
    },
    { name: 'reports a double space in JSX copy', code: '<p>Choose  a model</p>;', errors: 1 },
    { name: 'reports spacer-only expressions', code: '<p>{version}{"  "}{date}</p>;', errors: 1 },
    { name: 'reports repeated nonbreaking spaces', code: '<p>Name&nbsp;&nbsp;Status</p>;', errors: 1 },
    { name: 'reports entities in quoted JSX props', code: '<Button title="Name&nbsp;&nbsp;Status" />;', errors: 1 },
    { name: 'reports escaped nonbreaking spaces', code: 'const label = "Name\\u00a0\\u00a0Status";', errors: 1 },
    { name: 'reports extra spaces inside copy props', code: '<Button title="Choose  a model" />;', errors: 1 },
    {
      name: 'reports repeated spaces in returned copy bindings',
      code: 'const value = `v${version}  ${date}`; <span>{value}</span>;',
      errors: 1,
    },
  ],
});
