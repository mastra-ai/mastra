<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-sql [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-sql.svg)](https://www.npmjs.org/package/@codemirror/lang-sql)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-sql/blob/main/CHANGELOG.md) ]

This package implements SQL language support for the
[CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-sql/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"
import {sql} from "@codemirror/lang-sql"

const view = new EditorView({
  parent: document.body,
  doc: `select * from users where age > 20`,
  extensions: [basicSetup, sql()]
})
```

Use `sql({dialect: PostgreSQL})` or similar to select a specific SQL
dialect.

## API Reference

<dl>
<dt id="user-content-sql">
  <code><strong><a href="#user-content-sql">sql</a></strong>(<a id="user-content-sql^config" href="#user-content-sql^config">config</a>&#8288;?: <a href="#user-content-sqlconfig">SQLConfig</a> = {}) → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>SQL language support for the given SQL dialect, with keyword
completion, and, if provided, schema-based completion as extra
extensions.</p>
</dd>
<dt id="user-content-sqlconfig">
  <h4>
    <code>interface</code>
    <a href="#user-content-sqlconfig">SQLConfig</a></h4>
</dt>

<dd><p>Options used to configure an SQL extension.</p>
<dl><dt id="user-content-sqlconfig.dialect">
  <code><strong><a href="#user-content-sqlconfig.dialect">dialect</a></strong>&#8288;?: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p>The <a href="#user-content-sqldialect">dialect</a> to use. Defaults to
<a href="#user-content-standardsql"><code>StandardSQL</code></a>.</p>
</dd><dt id="user-content-sqlconfig.schema">
  <code><strong><a href="#user-content-sqlconfig.schema">schema</a></strong>&#8288;?: <a href="#user-content-sqlnamespace">SQLNamespace</a></code></dt>

<dd><p>You can use this to define the schemas, tables, and their fields
for autocompletion.</p>
</dd><dt id="user-content-sqlconfig.defaulttable">
  <code><strong><a href="#user-content-sqlconfig.defaulttable">defaultTable</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>When given, columns from the named table can be completed
directly at the top level.</p>
</dd><dt id="user-content-sqlconfig.defaultschema">
  <code><strong><a href="#user-content-sqlconfig.defaultschema">defaultSchema</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>When given, tables prefixed with this schema name can be
completed directly at the top level.</p>
</dd><dt id="user-content-sqlconfig.uppercasekeywords">
  <code><strong><a href="#user-content-sqlconfig.uppercasekeywords">upperCaseKeywords</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>When set to true, keyword completions will be upper-case.</p>
</dd><dt id="user-content-sqlconfig.keywordcompletion">
  <code><strong><a href="#user-content-sqlconfig.keywordcompletion">keywordCompletion</a></strong>&#8288;?: fn(<a id="user-content-sqlconfig.keywordcompletion^label" href="#user-content-sqlconfig.keywordcompletion^label">label</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, <a id="user-content-sqlconfig.keywordcompletion^type" href="#user-content-sqlconfig.keywordcompletion^type">type</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>) → <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a></code></dt>

<dd><p>Can be used to customize the completions generated for keywords.</p>
</dd></dl>

</dd>
<dt id="user-content-sqlnamespace">
  <code>
    type
    <strong><a href="#user-content-sqlnamespace">SQLNamespace</a></strong> = <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;<a href="#user-content-sqlnamespace">SQLNamespace</a>&gt; | {self: <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>, children: <a href="#user-content-sqlnamespace">SQLNamespace</a>} | readonly (<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a> | <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>)[]</code>
</dt>

<dd><p>The type used to describe a level of the schema for
<a href="#user-content-sqlconfig.schema">completion</a>. Can be an array of
options (columns), an object mapping table or schema names to
deeper levels, or a <code>{self, children}</code> object that assigns a
completion option to use for its parent property, when the default option
(its name as label and type <code>&quot;type&quot;</code>) isn't suitable.</p>
</dd>
<dt id="user-content-sqldialect">
  <h4>
    <code>class</code>
    <a href="#user-content-sqldialect">SQLDialect</a></h4>
</dt>

<dd><p>Represents an SQL dialect.</p>
<dl><dt id="user-content-sqldialect.language">
  <code><strong><a href="#user-content-sqldialect.language">language</a></strong>: <a href="https://codemirror.net/docs/ref#language.LRLanguage">LRLanguage</a></code></dt>

<dd><p>The language for this dialect.</p>
</dd><dt id="user-content-sqldialect.spec">
  <code><strong><a href="#user-content-sqldialect.spec">spec</a></strong>: <a href="#user-content-sqldialectspec">SQLDialectSpec</a></code></dt>

<dd><p>The spec used to define this dialect.</p>
</dd><dt id="user-content-sqldialect.extension">
  <code><strong><a href="#user-content-sqldialect.extension">extension</a></strong>: <a href="https://codemirror.net/docs/ref#state.Extension">Extension</a></code></dt>

<dd><p>Returns the language for this dialect as an extension.</p>
</dd><dt id="user-content-sqldialect^define">
  <code>static <strong><a href="#user-content-sqldialect^define">define</a></strong>(<a id="user-content-sqldialect^define^spec" href="#user-content-sqldialect^define^spec">spec</a>: <a href="#user-content-sqldialectspec">SQLDialectSpec</a>) → <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p>Define a new dialect.</p>
</dd></dl>

</dd>
<dt id="user-content-sqldialectspec">
  <h4>
    <code>type</code>
    <a href="#user-content-sqldialectspec">SQLDialectSpec</a></h4>
</dt>

<dd><p>Configuration for an <a href="#user-content-sqldialect">SQL Dialect</a>.</p>
<dl><dt id="user-content-sqldialectspec.keywords">
  <code><strong><a href="#user-content-sqldialectspec.keywords">keywords</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>A space-separated list of keywords for the dialect.</p>
</dd><dt id="user-content-sqldialectspec.builtin">
  <code><strong><a href="#user-content-sqldialectspec.builtin">builtin</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>A space-separated string of built-in identifiers for the dialect.</p>
</dd><dt id="user-content-sqldialectspec.types">
  <code><strong><a href="#user-content-sqldialectspec.types">types</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>A space-separated string of type names for the dialect.</p>
</dd><dt id="user-content-sqldialectspec.backslashescapes">
  <code><strong><a href="#user-content-sqldialectspec.backslashescapes">backslashEscapes</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Controls whether regular strings allow backslash escapes.</p>
</dd><dt id="user-content-sqldialectspec.hashcomments">
  <code><strong><a href="#user-content-sqldialectspec.hashcomments">hashComments</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Controls whether # creates a line comment.</p>
</dd><dt id="user-content-sqldialectspec.slashcomments">
  <code><strong><a href="#user-content-sqldialectspec.slashcomments">slashComments</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Controls whether <code>//</code> creates a line comment.</p>
</dd><dt id="user-content-sqldialectspec.spaceafterdashes">
  <code><strong><a href="#user-content-sqldialectspec.spaceafterdashes">spaceAfterDashes</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>When enabled <code>--</code> comments are only recognized when there's a
space after the dashes.</p>
</dd><dt id="user-content-sqldialectspec.doubledollarquotedstrings">
  <code><strong><a href="#user-content-sqldialectspec.doubledollarquotedstrings">doubleDollarQuotedStrings</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>When enabled, things quoted with &quot;$&quot; are treated as
strings, rather than identifiers.</p>
</dd><dt id="user-content-sqldialectspec.doublequotedstrings">
  <code><strong><a href="#user-content-sqldialectspec.doublequotedstrings">doubleQuotedStrings</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>When enabled, things quoted with double quotes are treated as
strings, rather than identifiers.</p>
</dd><dt id="user-content-sqldialectspec.charsetcasts">
  <code><strong><a href="#user-content-sqldialectspec.charsetcasts">charSetCasts</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Enables strings like <code>_utf8'str'</code> or <code>N'str'</code>.</p>
</dd><dt id="user-content-sqldialectspec.plsqlquotingmechanism">
  <code><strong><a href="#user-content-sqldialectspec.plsqlquotingmechanism">plsqlQuotingMechanism</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Enables string quoting syntax like <code>q'[str]'</code>, as used in
PL/SQL.</p>
</dd><dt id="user-content-sqldialectspec.operatorchars">
  <code><strong><a href="#user-content-sqldialectspec.operatorchars">operatorChars</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The set of characters that make up operators. Defaults to
<code>&quot;*+\-%&lt;&gt;!=&amp;|~^/&quot;</code>.</p>
</dd><dt id="user-content-sqldialectspec.specialvar">
  <code><strong><a href="#user-content-sqldialectspec.specialvar">specialVar</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The set of characters that start a special variable name.
Defaults to <code>&quot;?&quot;</code>.</p>
</dd><dt id="user-content-sqldialectspec.identifierquotes">
  <code><strong><a href="#user-content-sqldialectspec.identifierquotes">identifierQuotes</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The characters that can be used to quote identifiers. Defaults
to <code>&quot;\&quot;&quot;</code>.</p>
</dd><dt id="user-content-sqldialectspec.caseinsensitiveidentifiers">
  <code><strong><a href="#user-content-sqldialectspec.caseinsensitiveidentifiers">caseInsensitiveIdentifiers</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Controls whether identifiers are case-insensitive. Identifiers
with upper-case letters are quoted when set to false (which is
the default).</p>
</dd><dt id="user-content-sqldialectspec.unquotedbitliterals">
  <code><strong><a href="#user-content-sqldialectspec.unquotedbitliterals">unquotedBitLiterals</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Controls whether bit values can be defined as 0b1010. Defaults
to false.</p>
</dd><dt id="user-content-sqldialectspec.treatbitsasbytes">
  <code><strong><a href="#user-content-sqldialectspec.treatbitsasbytes">treatBitsAsBytes</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Controls whether bit values can contain other characters than 0 and 1.
Defaults to false.</p>
</dd></dl>

</dd>
<dt id="user-content-standardsql">
  <code><strong><a href="#user-content-standardsql">StandardSQL</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p>The standard SQL dialect.</p>
</dd>
<dt id="user-content-postgresql">
  <code><strong><a href="#user-content-postgresql">PostgreSQL</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p>Dialect for <a href="https://www.postgresql.org">PostgreSQL</a>.</p>
</dd>
<dt id="user-content-mysql">
  <code><strong><a href="#user-content-mysql">MySQL</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p><a href="https://dev.mysql.com/">MySQL</a> dialect.</p>
</dd>
<dt id="user-content-mariasql">
  <code><strong><a href="#user-content-mariasql">MariaSQL</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p>Variant of <a href="#user-content-mysql"><code>MySQL</code></a> for
<a href="https://mariadb.org/">MariaDB</a>.</p>
</dd>
<dt id="user-content-mssql">
  <code><strong><a href="#user-content-mssql">MSSQL</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p>SQL dialect for Microsoft <a href="https://www.microsoft.com/en-us/sql-server">SQL
Server</a>.</p>
</dd>
<dt id="user-content-sqlite">
  <code><strong><a href="#user-content-sqlite">SQLite</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p><a href="https://sqlite.org/">SQLite</a> dialect.</p>
</dd>
<dt id="user-content-cassandra">
  <code><strong><a href="#user-content-cassandra">Cassandra</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p>Dialect for <a href="https://cassandra.apache.org/">Cassandra</a>'s SQL-ish query language.</p>
</dd>
<dt id="user-content-plsql">
  <code><strong><a href="#user-content-plsql">PLSQL</a></strong>: <a href="#user-content-sqldialect">SQLDialect</a></code></dt>

<dd><p><a href="https://en.wikipedia.org/wiki/PL/SQL">PL/SQL</a> dialect.</p>
</dd>
<dt id="user-content-keywordcompletionsource">
  <code><strong><a href="#user-content-keywordcompletionsource">keywordCompletionSource</a></strong>(<a id="user-content-keywordcompletionsource^dialect" href="#user-content-keywordcompletionsource^dialect">dialect</a>: <a href="#user-content-sqldialect">SQLDialect</a>, <a id="user-content-keywordcompletionsource^uppercase" href="#user-content-keywordcompletionsource^uppercase">upperCase</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a> = false, <a id="user-content-keywordcompletionsource^build" href="#user-content-keywordcompletionsource^build">build</a>&#8288;?: fn(<a id="user-content-keywordcompletionsource^build^label" href="#user-content-keywordcompletionsource^build^label">label</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, <a id="user-content-keywordcompletionsource^build^type" href="#user-content-keywordcompletionsource^build^type">type</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>) → <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>) → <a href="https://codemirror.net/docs/ref#autocomplete.CompletionSource">CompletionSource</a></code></dt>

<dd><p>Returns a completion source that provides keyword completion for
the given SQL dialect.</p>
</dd>
<dt id="user-content-schemacompletionsource">
  <code><strong><a href="#user-content-schemacompletionsource">schemaCompletionSource</a></strong>(<a id="user-content-schemacompletionsource^config" href="#user-content-schemacompletionsource^config">config</a>: <a href="#user-content-sqlconfig">SQLConfig</a>) → <a href="https://codemirror.net/docs/ref#autocomplete.CompletionSource">CompletionSource</a></code></dt>

<dd><p>Returns a completion sources that provides schema-based completion
for the given configuration.</p>
</dd>
</dl>
