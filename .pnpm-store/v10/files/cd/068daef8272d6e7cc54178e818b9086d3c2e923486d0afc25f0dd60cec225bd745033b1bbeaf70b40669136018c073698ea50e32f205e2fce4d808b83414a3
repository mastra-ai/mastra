<!-- NOTE: README.md is generated from mode/README.md -->

# @codemirror/legacy-modes [![NPM version](https://img.shields.io/npm/v/@codemirror/legacy-modes.svg)](https://www.npmjs.org/package/@codemirror/legacy-modes)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/legacy-modes/blob/main/CHANGELOG.md) ]

This package implements a collection of ported [stream
language](https://codemirror.net/docs/ref#language.StreamParser) modes for
the [CodeMirror](https://codemirror.net/) code editor. Each mode is
available as a separate script file, under
`"@codemirror/legacy-modes/mode/[name]"`, and exports the values
listed below.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/legacy-modes/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

Using modes from this package works like this:

 - Install this package and the
   [`@codemirror/language`](https://codemirror.net/docs/ref/#language)
   package.

 - Find the `StreamParser` instance you need in the reference below.

 - Add `StreamLanguage.define(theParser)` to your editor's
   configuration.

For example, to load the Lua mode, you'd do something like...

```javascript
import {StreamLanguage} from "@codemirror/language"
import {lua} from "@codemirror/legacy-modes/mode/lua"

import {EditorView, basicSetup} from "codemirror"

let view = new EditorView({
  extensions: [basicSetup, StreamLanguage.define(lua)]
})
```

## API Reference


<h3 id="user-content-apl">mode/<a href="#user-content-apl">apl</a></h3>
<dl>
<dt id="user-content-apl.apl">
  <code><strong><a href="#user-content-apl.apl">apl</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-asciiarmor">mode/<a href="#user-content-asciiarmor">asciiarmor</a></h3>
<dl>
<dt id="user-content-asciiarmor.asciiarmor">
  <code><strong><a href="#user-content-asciiarmor.asciiarmor">asciiArmor</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-asn1">mode/<a href="#user-content-asn1">asn1</a></h3>
<dl>
<dt id="user-content-asn1.asn1">
  <code><strong><a href="#user-content-asn1.asn1">asn1</a></strong>(<a id="user-content-asn1.asn1^conf" href="#user-content-asn1.asn1^conf">conf</a>: {keywords&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, cmipVerbs&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, compareTypes&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, status&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, tags&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, storage&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, modifier&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, accessTypes&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, multiLineStrings&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>}) → <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-asterisk">mode/<a href="#user-content-asterisk">asterisk</a></h3>
<dl>
<dt id="user-content-asterisk.asterisk">
  <code><strong><a href="#user-content-asterisk.asterisk">asterisk</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-brainfuck">mode/<a href="#user-content-brainfuck">brainfuck</a></h3>
<dl>
<dt id="user-content-brainfuck.brainfuck">
  <code><strong><a href="#user-content-brainfuck.brainfuck">brainfuck</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-clike">mode/<a href="#user-content-clike">clike</a></h3>
<dl>
<dt id="user-content-clike.clike">
  <code><strong><a href="#user-content-clike.clike">clike</a></strong>(<a id="user-content-clike.clike^conf" href="#user-content-clike.clike^conf">conf</a>: {name: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, statementIndentUnit&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, dontAlignCalls&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>, keywords&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, types&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, builtin&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, blockKeywords&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, atoms&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, hooks&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, multiLineStrings&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>, indentStatements&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>, indentSwitch&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>, namespaceSeparator&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, isPunctuationChar&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>, numberStart&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>, number&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>, isOperatorChar&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>, isIdentifierChar&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>, isReservedIdentifier&#8288;?: fn(<a id="user-content-clike.clike^conf.isreservedidentifier^id" href="#user-content-clike.clike^conf.isreservedidentifier^id">id</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>}) → <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.c">
  <code><strong><a href="#user-content-clike.c">c</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.cpp">
  <code><strong><a href="#user-content-clike.cpp">cpp</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.java">
  <code><strong><a href="#user-content-clike.java">java</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.csharp">
  <code><strong><a href="#user-content-clike.csharp">csharp</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.scala">
  <code><strong><a href="#user-content-clike.scala">scala</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.kotlin">
  <code><strong><a href="#user-content-clike.kotlin">kotlin</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.shader">
  <code><strong><a href="#user-content-clike.shader">shader</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.nesc">
  <code><strong><a href="#user-content-clike.nesc">nesC</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.objectivec">
  <code><strong><a href="#user-content-clike.objectivec">objectiveC</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.objectivecpp">
  <code><strong><a href="#user-content-clike.objectivecpp">objectiveCpp</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.squirrel">
  <code><strong><a href="#user-content-clike.squirrel">squirrel</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.ceylon">
  <code><strong><a href="#user-content-clike.ceylon">ceylon</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-clike.dart">
  <code><strong><a href="#user-content-clike.dart">dart</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-clojure">mode/<a href="#user-content-clojure">clojure</a></h3>
<dl>
<dt id="user-content-clojure.clojure">
  <code><strong><a href="#user-content-clojure.clojure">clojure</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-cmake">mode/<a href="#user-content-cmake">cmake</a></h3>
<dl>
<dt id="user-content-cmake.cmake">
  <code><strong><a href="#user-content-cmake.cmake">cmake</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-cobol">mode/<a href="#user-content-cobol">cobol</a></h3>
<dl>
<dt id="user-content-cobol.cobol">
  <code><strong><a href="#user-content-cobol.cobol">cobol</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-coffeescript">mode/<a href="#user-content-coffeescript">coffeescript</a></h3>
<dl>
<dt id="user-content-coffeescript.coffeescript">
  <code><strong><a href="#user-content-coffeescript.coffeescript">coffeeScript</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-commonlisp">mode/<a href="#user-content-commonlisp">commonlisp</a></h3>
<dl>
<dt id="user-content-commonlisp.commonlisp">
  <code><strong><a href="#user-content-commonlisp.commonlisp">commonLisp</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-crystal">mode/<a href="#user-content-crystal">crystal</a></h3>
<dl>
<dt id="user-content-crystal.crystal">
  <code><strong><a href="#user-content-crystal.crystal">crystal</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-css">mode/<a href="#user-content-css">css</a></h3>
<dl>
<dt id="user-content-css.css">
  <code><strong><a href="#user-content-css.css">css</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-css.scss">
  <code><strong><a href="#user-content-css.scss">sCSS</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-css.less">
  <code><strong><a href="#user-content-css.less">less</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-css.gss">
  <code><strong><a href="#user-content-css.gss">gss</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-cypher">mode/<a href="#user-content-cypher">cypher</a></h3>
<dl>
<dt id="user-content-cypher.cypher">
  <code><strong><a href="#user-content-cypher.cypher">cypher</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-d">mode/<a href="#user-content-d">d</a></h3>
<dl>
<dt id="user-content-d.d">
  <code><strong><a href="#user-content-d.d">d</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-diff">mode/<a href="#user-content-diff">diff</a></h3>
<dl>
<dt id="user-content-diff.diff">
  <code><strong><a href="#user-content-diff.diff">diff</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-dockerfile">mode/<a href="#user-content-dockerfile">dockerfile</a></h3>
<dl>
<dt id="user-content-dockerfile.dockerfile">
  <code><strong><a href="#user-content-dockerfile.dockerfile">dockerFile</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-dtd">mode/<a href="#user-content-dtd">dtd</a></h3>
<dl>
<dt id="user-content-dtd.dtd">
  <code><strong><a href="#user-content-dtd.dtd">dtd</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-dylan">mode/<a href="#user-content-dylan">dylan</a></h3>
<dl>
<dt id="user-content-dylan.dylan">
  <code><strong><a href="#user-content-dylan.dylan">dylan</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-ebnf">mode/<a href="#user-content-ebnf">ebnf</a></h3>
<dl>
<dt id="user-content-ebnf.ebnf">
  <code><strong><a href="#user-content-ebnf.ebnf">ebnf</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-ecl">mode/<a href="#user-content-ecl">ecl</a></h3>
<dl>
<dt id="user-content-ecl.ecl">
  <code><strong><a href="#user-content-ecl.ecl">ecl</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-eiffel">mode/<a href="#user-content-eiffel">eiffel</a></h3>
<dl>
<dt id="user-content-eiffel.eiffel">
  <code><strong><a href="#user-content-eiffel.eiffel">eiffel</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-elm">mode/<a href="#user-content-elm">elm</a></h3>
<dl>
<dt id="user-content-elm.elm">
  <code><strong><a href="#user-content-elm.elm">elm</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-erlang">mode/<a href="#user-content-erlang">erlang</a></h3>
<dl>
<dt id="user-content-erlang.erlang">
  <code><strong><a href="#user-content-erlang.erlang">erlang</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-factor">mode/<a href="#user-content-factor">factor</a></h3>
<dl>
<dt id="user-content-factor.factor">
  <code><strong><a href="#user-content-factor.factor">factor</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-fcl">mode/<a href="#user-content-fcl">fcl</a></h3>
<dl>
<dt id="user-content-fcl.fcl">
  <code><strong><a href="#user-content-fcl.fcl">fcl</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-forth">mode/<a href="#user-content-forth">forth</a></h3>
<dl>
<dt id="user-content-forth.forth">
  <code><strong><a href="#user-content-forth.forth">forth</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-fortran">mode/<a href="#user-content-fortran">fortran</a></h3>
<dl>
<dt id="user-content-fortran.fortran">
  <code><strong><a href="#user-content-fortran.fortran">fortran</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-gas">mode/<a href="#user-content-gas">gas</a></h3>
<dl>
<dt id="user-content-gas.gas">
  <code><strong><a href="#user-content-gas.gas">gas</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-gas.gasarm">
  <code><strong><a href="#user-content-gas.gasarm">gasArm</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-gherkin">mode/<a href="#user-content-gherkin">gherkin</a></h3>
<dl>
<dt id="user-content-gherkin.gherkin">
  <code><strong><a href="#user-content-gherkin.gherkin">gherkin</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-go">mode/<a href="#user-content-go">go</a></h3>
<dl>
<dt id="user-content-go.go">
  <code><strong><a href="#user-content-go.go">go</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-groovy">mode/<a href="#user-content-groovy">groovy</a></h3>
<dl>
<dt id="user-content-groovy.groovy">
  <code><strong><a href="#user-content-groovy.groovy">groovy</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-haskell">mode/<a href="#user-content-haskell">haskell</a></h3>
<dl>
<dt id="user-content-haskell.haskell">
  <code><strong><a href="#user-content-haskell.haskell">haskell</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-haxe">mode/<a href="#user-content-haxe">haxe</a></h3>
<dl>
<dt id="user-content-haxe.haxe">
  <code><strong><a href="#user-content-haxe.haxe">haxe</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-haxe.hxml">
  <code><strong><a href="#user-content-haxe.hxml">hxml</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-http">mode/<a href="#user-content-http">http</a></h3>
<dl>
<dt id="user-content-http.http">
  <code><strong><a href="#user-content-http.http">http</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-idl">mode/<a href="#user-content-idl">idl</a></h3>
<dl>
<dt id="user-content-idl.idl">
  <code><strong><a href="#user-content-idl.idl">idl</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-javascript">mode/<a href="#user-content-javascript">javascript</a></h3>
<dl>
<dt id="user-content-javascript.javascript">
  <code><strong><a href="#user-content-javascript.javascript">javascript</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-javascript.json">
  <code><strong><a href="#user-content-javascript.json">json</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-javascript.jsonld">
  <code><strong><a href="#user-content-javascript.jsonld">jsonld</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-javascript.typescript">
  <code><strong><a href="#user-content-javascript.typescript">typescript</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-jinja2">mode/<a href="#user-content-jinja2">jinja2</a></h3>
<dl>
<dt id="user-content-jinja2.jinja2">
  <code><strong><a href="#user-content-jinja2.jinja2">jinja2</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-julia">mode/<a href="#user-content-julia">julia</a></h3>
<dl>
<dt id="user-content-julia.julia">
  <code><strong><a href="#user-content-julia.julia">julia</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-livescript">mode/<a href="#user-content-livescript">livescript</a></h3>
<dl>
<dt id="user-content-livescript.livescript">
  <code><strong><a href="#user-content-livescript.livescript">liveScript</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-lua">mode/<a href="#user-content-lua">lua</a></h3>
<dl>
<dt id="user-content-lua.lua">
  <code><strong><a href="#user-content-lua.lua">lua</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-mathematica">mode/<a href="#user-content-mathematica">mathematica</a></h3>
<dl>
<dt id="user-content-mathematica.mathematica">
  <code><strong><a href="#user-content-mathematica.mathematica">mathematica</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-mbox">mode/<a href="#user-content-mbox">mbox</a></h3>
<dl>
<dt id="user-content-mbox.mbox">
  <code><strong><a href="#user-content-mbox.mbox">mbox</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-mirc">mode/<a href="#user-content-mirc">mirc</a></h3>
<dl>
<dt id="user-content-mirc.mirc">
  <code><strong><a href="#user-content-mirc.mirc">mirc</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-mllike">mode/<a href="#user-content-mllike">mllike</a></h3>
<dl>
<dt id="user-content-mllike.ocaml">
  <code><strong><a href="#user-content-mllike.ocaml">oCaml</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-mllike.fsharp">
  <code><strong><a href="#user-content-mllike.fsharp">fSharp</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-mllike.sml">
  <code><strong><a href="#user-content-mllike.sml">sml</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-modelica">mode/<a href="#user-content-modelica">modelica</a></h3>
<dl>
<dt id="user-content-modelica.modelica">
  <code><strong><a href="#user-content-modelica.modelica">modelica</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-mscgen">mode/<a href="#user-content-mscgen">mscgen</a></h3>
<dl>
<dt id="user-content-mscgen.mscgen">
  <code><strong><a href="#user-content-mscgen.mscgen">mscgen</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-mscgen.msgenny">
  <code><strong><a href="#user-content-mscgen.msgenny">msgenny</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-mscgen.xu">
  <code><strong><a href="#user-content-mscgen.xu">xu</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-mumps">mode/<a href="#user-content-mumps">mumps</a></h3>
<dl>
<dt id="user-content-mumps.mumps">
  <code><strong><a href="#user-content-mumps.mumps">mumps</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-nginx">mode/<a href="#user-content-nginx">nginx</a></h3>
<dl>
<dt id="user-content-nginx.nginx">
  <code><strong><a href="#user-content-nginx.nginx">nginx</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-nsis">mode/<a href="#user-content-nsis">nsis</a></h3>
<dl>
<dt id="user-content-nsis.nsis">
  <code><strong><a href="#user-content-nsis.nsis">nsis</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-ntriples">mode/<a href="#user-content-ntriples">ntriples</a></h3>
<dl>
<dt id="user-content-ntriples.ntriples">
  <code><strong><a href="#user-content-ntriples.ntriples">ntriples</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-octave">mode/<a href="#user-content-octave">octave</a></h3>
<dl>
<dt id="user-content-octave.octave">
  <code><strong><a href="#user-content-octave.octave">octave</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-oz">mode/<a href="#user-content-oz">oz</a></h3>
<dl>
<dt id="user-content-oz.oz">
  <code><strong><a href="#user-content-oz.oz">oz</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-pascal">mode/<a href="#user-content-pascal">pascal</a></h3>
<dl>
<dt id="user-content-pascal.pascal">
  <code><strong><a href="#user-content-pascal.pascal">pascal</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-pegjs">mode/<a href="#user-content-pegjs">pegjs</a></h3>
<dl>
<dt id="user-content-pegjs.pegjs">
  <code><strong><a href="#user-content-pegjs.pegjs">pegjs</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-perl">mode/<a href="#user-content-perl">perl</a></h3>
<dl>
<dt id="user-content-perl.perl">
  <code><strong><a href="#user-content-perl.perl">perl</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-pig">mode/<a href="#user-content-pig">pig</a></h3>
<dl>
<dt id="user-content-pig.pig">
  <code><strong><a href="#user-content-pig.pig">pig</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-powershell">mode/<a href="#user-content-powershell">powershell</a></h3>
<dl>
<dt id="user-content-powershell.powershell">
  <code><strong><a href="#user-content-powershell.powershell">powerShell</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-properties">mode/<a href="#user-content-properties">properties</a></h3>
<dl>
<dt id="user-content-properties.properties">
  <code><strong><a href="#user-content-properties.properties">properties</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-protobuf">mode/<a href="#user-content-protobuf">protobuf</a></h3>
<dl>
<dt id="user-content-protobuf.protobuf">
  <code><strong><a href="#user-content-protobuf.protobuf">protobuf</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-pug">mode/<a href="#user-content-pug">pug</a></h3>
<dl>
<dt id="user-content-pug.pug">
  <code><strong><a href="#user-content-pug.pug">pug</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-puppet">mode/<a href="#user-content-puppet">puppet</a></h3>
<dl>
<dt id="user-content-puppet.puppet">
  <code><strong><a href="#user-content-puppet.puppet">puppet</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-python">mode/<a href="#user-content-python">python</a></h3>
<dl>
<dt id="user-content-python.python">
  <code><strong><a href="#user-content-python.python">python</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-python.cython">
  <code><strong><a href="#user-content-python.cython">cython</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-q">mode/<a href="#user-content-q">q</a></h3>
<dl>
<dt id="user-content-q.q">
  <code><strong><a href="#user-content-q.q">q</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-r">mode/<a href="#user-content-r">r</a></h3>
<dl>
<dt id="user-content-r.r">
  <code><strong><a href="#user-content-r.r">r</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-rpm">mode/<a href="#user-content-rpm">rpm</a></h3>
<dl>
<dt id="user-content-rpm.rpmchanges">
  <code><strong><a href="#user-content-rpm.rpmchanges">rpmChanges</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-rpm.rpmspec">
  <code><strong><a href="#user-content-rpm.rpmspec">rpmSpec</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-ruby">mode/<a href="#user-content-ruby">ruby</a></h3>
<dl>
<dt id="user-content-ruby.ruby">
  <code><strong><a href="#user-content-ruby.ruby">ruby</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-rust">mode/<a href="#user-content-rust">rust</a></h3>
<dl>
<dt id="user-content-rust.rust">
  <code><strong><a href="#user-content-rust.rust">rust</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-sas">mode/<a href="#user-content-sas">sas</a></h3>
<dl>
<dt id="user-content-sas.sas">
  <code><strong><a href="#user-content-sas.sas">sas</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-sass">mode/<a href="#user-content-sass">sass</a></h3>
<dl>
<dt id="user-content-sass.sass">
  <code><strong><a href="#user-content-sass.sass">sass</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-scheme">mode/<a href="#user-content-scheme">scheme</a></h3>
<dl>
<dt id="user-content-scheme.scheme">
  <code><strong><a href="#user-content-scheme.scheme">scheme</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-shell">mode/<a href="#user-content-shell">shell</a></h3>
<dl>
<dt id="user-content-shell.shell">
  <code><strong><a href="#user-content-shell.shell">shell</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-sieve">mode/<a href="#user-content-sieve">sieve</a></h3>
<dl>
<dt id="user-content-sieve.sieve">
  <code><strong><a href="#user-content-sieve.sieve">sieve</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-simple-mode">mode/<a href="#user-content-simple-mode">simple-mode</a></h3>
<dl>
<dt id="user-content-simple-mode.rule">
  <h4>
    <code>interface</code>
    <a href="#user-content-simple-mode.rule">Rule</a></h4>
</dt>

<dd><dl><dt id="user-content-simple-mode.rule.regex">
  <code><strong><a href="#user-content-simple-mode.rule.regex">regex</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined">undefined</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.token">
  <code><strong><a href="#user-content-simple-mode.rule.token">token</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>[] | fn(<a id="user-content-simple-mode.rule.token^matches" href="#user-content-simple-mode.rule.token^matches">matches</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match#Return_value">RegExpMatchArray</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>[] | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined">undefined</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.sol">
  <code><strong><a href="#user-content-simple-mode.rule.sol">sol</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.next">
  <code><strong><a href="#user-content-simple-mode.rule.next">next</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.push">
  <code><strong><a href="#user-content-simple-mode.rule.push">push</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.pop">
  <code><strong><a href="#user-content-simple-mode.rule.pop">pop</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.indent">
  <code><strong><a href="#user-content-simple-mode.rule.indent">indent</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.dedent">
  <code><strong><a href="#user-content-simple-mode.rule.dedent">dedent</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd></dd><dt id="user-content-simple-mode.rule.dedentiflinestart">
  <code><strong><a href="#user-content-simple-mode.rule.dedentiflinestart">dedentIfLineStart</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd></dd></dl>

</dd>
<dt id="user-content-simple-mode.simplemode">
  <code><strong><a href="#user-content-simple-mode.simplemode">simpleMode</a></strong>&lt;<a id="user-content-simple-mode.simplemode^k" href="#user-content-simple-mode.simplemode^k">K</a> extends <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>&gt;(<a id="user-content-simple-mode.simplemode^states" href="#user-content-simple-mode.simplemode^states">states</a>: {[<a id="user-content-simple-mode.simplemode^states^p" href="#user-content-simple-mode.simplemode^states^p">P</a> in <a href="#user-content-simple-mode.simplemode^k">K</a>]: <a href="#user-content-simple-mode.simplemode^states^p">P</a> extends &quot;languageData&quot; ? <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt; : <a href="#user-content-simple-mode.rule">Rule</a>[]} &amp; {start: <a href="#user-content-simple-mode.rule">Rule</a>[]}) → <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-smalltalk">mode/<a href="#user-content-smalltalk">smalltalk</a></h3>
<dl>
<dt id="user-content-smalltalk.smalltalk">
  <code><strong><a href="#user-content-smalltalk.smalltalk">smalltalk</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-solr">mode/<a href="#user-content-solr">solr</a></h3>
<dl>
<dt id="user-content-solr.solr">
  <code><strong><a href="#user-content-solr.solr">solr</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-sparql">mode/<a href="#user-content-sparql">sparql</a></h3>
<dl>
<dt id="user-content-sparql.sparql">
  <code><strong><a href="#user-content-sparql.sparql">sparql</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-spreadsheet">mode/<a href="#user-content-spreadsheet">spreadsheet</a></h3>
<dl>
<dt id="user-content-spreadsheet.spreadsheet">
  <code><strong><a href="#user-content-spreadsheet.spreadsheet">spreadsheet</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-sql">mode/<a href="#user-content-sql">sql</a></h3>
<dl>
<dt id="user-content-sql.sql">
  <code><strong><a href="#user-content-sql.sql">sql</a></strong>(<a id="user-content-sql.sql^conf" href="#user-content-sql.sql^conf">conf</a>: {client&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, atoms&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, builtin&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, keywords&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, operatorChars&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>, support&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, hooks&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, dateSQL&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;any&gt;, backslashStringEscapes&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>, brackets&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>, punctuation&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp">RegExp</a>}) → <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.standardsql">
  <code><strong><a href="#user-content-sql.standardsql">standardSQL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.mssql">
  <code><strong><a href="#user-content-sql.mssql">msSQL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.mysql">
  <code><strong><a href="#user-content-sql.mysql">mySQL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.mariadb">
  <code><strong><a href="#user-content-sql.mariadb">mariaDB</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.sqlite">
  <code><strong><a href="#user-content-sql.sqlite">sqlite</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.cassandra">
  <code><strong><a href="#user-content-sql.cassandra">cassandra</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.plsql">
  <code><strong><a href="#user-content-sql.plsql">plSQL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.hive">
  <code><strong><a href="#user-content-sql.hive">hive</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.pgsql">
  <code><strong><a href="#user-content-sql.pgsql">pgSQL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.gql">
  <code><strong><a href="#user-content-sql.gql">gql</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.gpsql">
  <code><strong><a href="#user-content-sql.gpsql">gpSQL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.sparksql">
  <code><strong><a href="#user-content-sql.sparksql">sparkSQL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-sql.esper">
  <code><strong><a href="#user-content-sql.esper">esper</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-stex">mode/<a href="#user-content-stex">stex</a></h3>
<dl>
<dt id="user-content-stex.stex">
  <code><strong><a href="#user-content-stex.stex">stex</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-stex.stexmath">
  <code><strong><a href="#user-content-stex.stexmath">stexMath</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-stylus">mode/<a href="#user-content-stylus">stylus</a></h3>
<dl>
<dt id="user-content-stylus.stylus">
  <code><strong><a href="#user-content-stylus.stylus">stylus</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-swift">mode/<a href="#user-content-swift">swift</a></h3>
<dl>
<dt id="user-content-swift.swift">
  <code><strong><a href="#user-content-swift.swift">swift</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-tcl">mode/<a href="#user-content-tcl">tcl</a></h3>
<dl>
<dt id="user-content-tcl.tcl">
  <code><strong><a href="#user-content-tcl.tcl">tcl</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-textile">mode/<a href="#user-content-textile">textile</a></h3>
<dl>
<dt id="user-content-textile.textile">
  <code><strong><a href="#user-content-textile.textile">textile</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-tiddlywiki">mode/<a href="#user-content-tiddlywiki">tiddlywiki</a></h3>
<dl>
<dt id="user-content-tiddlywiki.tiddlywiki">
  <code><strong><a href="#user-content-tiddlywiki.tiddlywiki">tiddlyWiki</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-tiki">mode/<a href="#user-content-tiki">tiki</a></h3>
<dl>
<dt id="user-content-tiki.tiki">
  <code><strong><a href="#user-content-tiki.tiki">tiki</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-toml">mode/<a href="#user-content-toml">toml</a></h3>
<dl>
<dt id="user-content-toml.toml">
  <code><strong><a href="#user-content-toml.toml">toml</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-troff">mode/<a href="#user-content-troff">troff</a></h3>
<dl>
<dt id="user-content-troff.troff">
  <code><strong><a href="#user-content-troff.troff">troff</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-ttcn-cfg">mode/<a href="#user-content-ttcn-cfg">ttcn-cfg</a></h3>
<dl>
<dt id="user-content-ttcn-cfg.ttcncfg">
  <code><strong><a href="#user-content-ttcn-cfg.ttcncfg">ttcnCfg</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-ttcn">mode/<a href="#user-content-ttcn">ttcn</a></h3>
<dl>
<dt id="user-content-ttcn.ttcn">
  <code><strong><a href="#user-content-ttcn.ttcn">ttcn</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-turtle">mode/<a href="#user-content-turtle">turtle</a></h3>
<dl>
<dt id="user-content-turtle.turtle">
  <code><strong><a href="#user-content-turtle.turtle">turtle</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-vb">mode/<a href="#user-content-vb">vb</a></h3>
<dl>
<dt id="user-content-vb.vb">
  <code><strong><a href="#user-content-vb.vb">vb</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-vbscript">mode/<a href="#user-content-vbscript">vbscript</a></h3>
<dl>
<dt id="user-content-vbscript.vbscript">
  <code><strong><a href="#user-content-vbscript.vbscript">vbScript</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-vbscript.vbscriptasp">
  <code><strong><a href="#user-content-vbscript.vbscriptasp">vbScriptASP</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-velocity">mode/<a href="#user-content-velocity">velocity</a></h3>
<dl>
<dt id="user-content-velocity.velocity">
  <code><strong><a href="#user-content-velocity.velocity">velocity</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-verilog">mode/<a href="#user-content-verilog">verilog</a></h3>
<dl>
<dt id="user-content-verilog.verilog">
  <code><strong><a href="#user-content-verilog.verilog">verilog</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-verilog.tlv">
  <code><strong><a href="#user-content-verilog.tlv">tlv</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-vhdl">mode/<a href="#user-content-vhdl">vhdl</a></h3>
<dl>
<dt id="user-content-vhdl.vhdl">
  <code><strong><a href="#user-content-vhdl.vhdl">vhdl</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-wast">mode/<a href="#user-content-wast">wast</a></h3>
<dl>
<dt id="user-content-wast.wast">
  <code><strong><a href="#user-content-wast.wast">wast</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-webidl">mode/<a href="#user-content-webidl">webidl</a></h3>
<dl>
<dt id="user-content-webidl.webidl">
  <code><strong><a href="#user-content-webidl.webidl">webIDL</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-xml">mode/<a href="#user-content-xml">xml</a></h3>
<dl>
<dt id="user-content-xml.xml">
  <code><strong><a href="#user-content-xml.xml">xml</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-xml.html">
  <code><strong><a href="#user-content-xml.html">html</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-xquery">mode/<a href="#user-content-xquery">xquery</a></h3>
<dl>
<dt id="user-content-xquery.xquery">
  <code><strong><a href="#user-content-xquery.xquery">xQuery</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-yacas">mode/<a href="#user-content-yacas">yacas</a></h3>
<dl>
<dt id="user-content-yacas.yacas">
  <code><strong><a href="#user-content-yacas.yacas">yacas</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-yaml">mode/<a href="#user-content-yaml">yaml</a></h3>
<dl>
<dt id="user-content-yaml.yaml">
  <code><strong><a href="#user-content-yaml.yaml">yaml</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>
<h3 id="user-content-z80">mode/<a href="#user-content-z80">z80</a></h3>
<dl>
<dt id="user-content-z80.z80">
  <code><strong><a href="#user-content-z80.z80">z80</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
<dt id="user-content-z80.ez80">
  <code><strong><a href="#user-content-z80.ez80">ez80</a></strong>: <a href="https://codemirror.net/docs/ref#language.StreamParser">StreamParser</a>&lt;unknown&gt;</code></dt>

<dd></dd>
</dl>