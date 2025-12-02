import {parser} from "../dist/index.js"
import {compareTree} from "./compare-tree.js"
import {SpecParser} from "./spec.js"

const specParser = new SpecParser(parser)

function test(name: string, spec: string) {
  it(name, () => {
    let {tree, doc} = specParser.parse(spec, name)
    compareTree(parser.parse(doc), tree)
  })
}

// These are the tests from revision 0.29 of the CommonMark spec,
// mechanically translated to the format used here (because their
// original format, providing expected HTML output, doesn't cover most
// of the aspects of the output that we're interested in), and then eyeballed
// to check whether the produced output corresponds to the intent of
// the test.

describe("CommonMark spec", () => {
  test("Tabs (example 1)", `
	{CB:{cT:foo	baz		bim}}
`)

  test("Tabs (example 2)", `
  	{CB:{cT:foo	baz		bim}}
`)

  test("Tabs (example 3)", `
    {CB:{cT:a	a
}    {cT:ὐ	a}}
`)

  test("Tabs (example 4)", `
{BL:{LI:  {l:-} {P:foo}

	{P:bar}}}
`)

  test("Tabs (example 5)", `
{BL:{LI:{l:-} {P:foo}

		{CB:{cT:bar}}}}
`)

  test("Tabs (example 6)", `
{Q:{q:>}		{CB:{cT:foo}}}
`)

  test("Tabs (example 7)", `
{BL:{LI:{l:-}		{CB:{cT:foo}}}}
`)

  test("Tabs (example 8)", `
    {CB:{cT:foo
}	{cT:bar}}
`)

  test("Tabs (example 9)", `
{BL:{LI: {l:-} {P:foo}
   {BL:{LI:{l:-} {P:bar}
	 {BL:{LI:{l:-} {P:baz}}}}}}}
`)

  test("Tabs (example 10)", `
{P:#	Foo}
`)

  test("Tabs (example 11)", `
{HR:*	*	*	}
`)

  test("Precedence (example 12)", `
{BL:{LI:{l:-} {P:\`one}}
{LI:{l:-} {P:two\`}}}
`)

  test("Thematic breaks (example 13)", `
{HR:***}
{HR:---}
{HR:___}
`)

  test("Thematic breaks (example 14)", `
{P:+++}
`)

  test("Thematic breaks (example 15)", `
{P:===}
`)

  test("Thematic breaks (example 16)", `
{P:--
**
__}
`)

  test("Thematic breaks (example 17)", `
 {HR:***}
  {HR:***}
   {HR:***}
`)

  test("Thematic breaks (example 18)", `
    {CB:{cT:***}}
`)

  test("Thematic breaks (example 19)", `
{P:Foo
    ***}
`)

  test("Thematic breaks (example 20)", `
{HR:_____________________________________}
`)

  test("Thematic breaks (example 21)", `
 {HR:- - -}
`)

  test("Thematic breaks (example 22)", `
 {HR:**  * ** * ** * **}
`)

  test("Thematic breaks (example 23)", `
{HR:-     -      -      -}
`)

  test("Thematic breaks (example 24)", `
{HR:- - - -    }
`)

  test("Thematic breaks (example 25)", `
{P:_ _ _ _ a}

{P:a------}

{P:---a---}
`)

  test("Thematic breaks (example 26)", `
 {P:{Em:{e:*}-{e:*}}}
`)

  test("Thematic breaks (example 27)", `
{BL:{LI:{l:-} {P:foo}}}
{HR:***}
{BL:{LI:{l:-} {P:bar}}}
`)

  test("Thematic breaks (example 28)", `
{P:Foo}
{HR:***}
{P:bar}
`)

  test("Thematic breaks (example 29)", `
{SH2:Foo
{h:---}}
{P:bar}
`)

  test("Thematic breaks (example 30)", `
{BL:{LI:{l:*} {P:Foo}}}
{HR:* * *}
{BL:{LI:{l:*} {P:Bar}}}
`)

  test("Thematic breaks (example 31)", `
{BL:{LI:{l:-} {P:Foo}}
{LI:{l:-} {HR:* * *}}}
`)

  test("ATX headings (example 32)", `
{H1:{h:#} foo}
{H2:{h:##} foo}
{H3:{h:###} foo}
{H4:{h:####} foo}
{H5:{h:#####} foo}
{H6:{h:######} foo}
`)

  test("ATX headings (example 33)", `
{P:####### foo}
`)

  test("ATX headings (example 34)", `
{P:#5 bolt}

{P:#hashtag}
`)

  test("ATX headings (example 35)", `
{P:{Esc:\\#}# foo}
`)

  test("ATX headings (example 36)", `
{H1:{h:#} foo {Em:{e:*}bar{e:*}} {Esc:\\*}baz{Esc:\\*}}
`)

  test("ATX headings (example 37)", `
{H1:{h:#}                  foo                     }
`)

  test("ATX headings (example 38)", `
 {H3:{h:###} foo}
  {H2:{h:##} foo}
   {H1:{h:#} foo}
`)

  test("ATX headings (example 39)", `
    {CB:{cT:# foo}}
`)

  test("ATX headings (example 40)", `
{P:foo
    # bar}
`)

  test("ATX headings (example 41)", `
{H2:{h:##} foo {h:##}}
  {H3:{h:###}   bar    {h:###}}
`)

  test("ATX headings (example 42)", `
{H1:{h:#} foo {h:##################################}}
{H5:{h:#####} foo {h:##}}
`)

  test("ATX headings (example 43)", `
{H3:{h:###} foo {h:###}     }
`)

  test("ATX headings (example 44)", `
{H3:{h:###} foo ### b}
`)

  test("ATX headings (example 45)", `
{H1:{h:#} foo#}
`)

  test("ATX headings (example 46)", `
{H3:{h:###} foo {Esc:\\#}##}
{H2:{h:##} foo #{Esc:\\#}#}
{H1:{h:#} foo {Esc:\\#}}
`)

  test("ATX headings (example 47)", `
{HR:****}
{H2:{h:##} foo}
{HR:****}
`)

  test("ATX headings (example 48)", `
{P:Foo bar}
{H1:{h:#} baz}
{P:Bar foo}
`)

  test("ATX headings (example 49)", `
{H2:{h:##} }
{H1:{h:#}}
{H3:{h:###} {h:###}}
`)

  test("Setext headings (example 50)", `
{SH1:Foo {Em:{e:*}bar{e:*}}
{h:=========}}

{SH2:Foo {Em:{e:*}bar{e:*}}
{h:---------}}
`)

  test("Setext headings (example 51)", `
{SH1:Foo {Em:{e:*}bar
baz{e:*}}
{h:====}}
`)

  test("Setext headings (example 52)", `
  {SH1:Foo {Em:{e:*}bar
baz{e:*}}	
{h:====}}
`)

  test("Setext headings (example 53)", `
{SH2:Foo
{h:-------------------------}}

{SH1:Foo
{h:=}}
`)

  test("Setext headings (example 54)", `
   {SH2:Foo
{h:---}}

  {SH2:Foo
{h:-----}}

  {SH1:Foo
  {h:===}}
`)

  test("Setext headings (example 55)", `
    {CB:{cT:Foo
}    {cT:---

}    {cT:Foo}}
{HR:---}
`)

  test("Setext headings (example 56)", `
{SH2:Foo
   {h:----}      }
`)

  test("Setext headings (example 57)", `
{P:Foo
    ---}
`)

  test("Setext headings (example 58)", `
{P:Foo
= =}

{P:Foo}
{HR:--- -}
`)

  test("Setext headings (example 59)", `
{SH2:Foo  
{h:-----}}
`)

  test("Setext headings (example 60)", `
{SH2:Foo\\
{h:----}}
`)

  test("Setext headings (example 61)", `
{SH2:\`Foo
{h:----}}
{P:\`}

{SH2:<a title="a lot
{h:---}}
{P:of dashes"/>}
`)

  test("Setext headings (example 62)", `
{Q:{q:>} {P:Foo}}
{HR:---}
`)

  test("Setext headings (example 63)", `
{Q:{q:>} {P:foo
bar
===}}
`)

  test("Setext headings (example 64)", `
{BL:{LI:{l:-} {P:Foo}}}
{HR:---}
`)

  test("Setext headings (example 65)", `
{SH2:Foo
Bar
{h:---}}
`)

  test("Setext headings (example 66)", `
{HR:---}
{SH2:Foo
{h:---}}
{SH2:Bar
{h:---}}
{P:Baz}
`)

  test("Setext headings (example 67)", `

{P:====}
`)

  test("Setext headings (example 68)", `
{HR:---}
{HR:---}
`)

  test("Setext headings (example 69)", `
{BL:{LI:{l:-} {P:foo}}}
{HR:-----}
`)

  test("Setext headings (example 70)", `
    {CB:{cT:foo}}
{HR:---}
`)

  test("Setext headings (example 71)", `
{Q:{q:>} {P:foo}}
{HR:-----}
`)

  test("Setext headings (example 72)", `
{SH2:{Esc:\\>} foo
{h:------}}
`)

  test("Setext headings (example 73)", `
{P:Foo}

{SH2:bar
{h:---}}
{P:baz}
`)

  test("Setext headings (example 74)", `
{P:Foo
bar}

{HR:---}

{P:baz}
`)

  test("Setext headings (example 75)", `
{P:Foo
bar}
{HR:* * *}
{P:baz}
`)

  test("Setext headings (example 76)", `
{P:Foo
bar
{Esc:\\-}--
baz}
`)

  test("Indented code blocks (example 77)", `
    {CB:{cT:a simple
}    {cT:  indented code block}}
`)

  test("Indented code blocks (example 78)", `
{BL:{LI:  {l:-} {P:foo}

    {P:bar}}}
`)

  test("Indented code blocks (example 79)", `
{OL:{LI:{l:1.}  {P:foo}

    {BL:{LI:{l:-} {P:bar}}}}}
`)

  test("Indented code blocks (example 80)", `
    {CB:{cT:<a/>
}    {cT:*hi*

}    {cT:- one}}
`)

  test("Indented code blocks (example 81)", `
    {CB:{cT:chunk1

}    {cT:chunk2
}  {cT:
} {cT:
} {cT:
}    {cT:chunk3}}
`)

  test("Indented code blocks (example 82)", `
    {CB:{cT:chunk1
}      {cT:
}    {cT:  chunk2}}
`)

  test("Indented code blocks (example 83)", `
{P:Foo
    bar}

`)

  test("Indented code blocks (example 84)", `
    {CB:{cT:foo}}
{P:bar}
`)

  test("Indented code blocks (example 85)", `
{H1:{h:#} Heading}
    {CB:{cT:foo}}
{SH2:Heading
{h:------}}
    {CB:{cT:foo}}
{HR:----}
`)

  test("Indented code blocks (example 86)", `
    {CB:{cT:    foo
}    {cT:bar}}
`)

  test("Indented code blocks (example 87)", `
    
    {CB:{cT:foo}}
    
`)

  test("Indented code blocks (example 88)", `
    {CB:{cT:foo  }}
`)

  test("Fenced code blocks (example 89)", `
{FC:{c:\`\`\`}
{cT:<
 >}
{c:\`\`\`}}
`)

  test("Fenced code blocks (example 90)", `
{FC:{c:~~~}
{cT:<
 >}
{c:~~~}}
`)

  test("Fenced code blocks (example 91)", `
{P:{C:{c:\`\`}
foo
{c:\`\`}}}
`)

  test("Fenced code blocks (example 92)", `
{FC:{c:\`\`\`}
{cT:aaa
~~~}
{c:\`\`\`}}
`)

  test("Fenced code blocks (example 93)", `
{FC:{c:~~~}
{cT:aaa
\`\`\`}
{c:~~~}}
`)

  test("Fenced code blocks (example 94)", `
{FC:{c:\`\`\`\`}
{cT:aaa
\`\`\`}
{c:\`\`\`\`\`\`}}
`)

  test("Fenced code blocks (example 95)", `
{FC:{c:~~~~}
{cT:aaa
~~~}
{c:~~~~}}
`)

  test("Fenced code blocks (example 96)", `
{FC:{c:\`\`\`}
}`)

  test("Fenced code blocks (example 97)", `
{FC:{c:\`\`\`\`\`}
{cT:
\`\`\`
aaa
}}`)

  test("Fenced code blocks (example 98)", `
{Q:{q:>} {FC:{c:\`\`\`}
{q:>} {cT:aaa}}}

{P:bbb}
`)

  test("Fenced code blocks (example 99)", `
{FC:{c:\`\`\`}
{cT:
  }
{c:\`\`\`}}
`)

  test("Fenced code blocks (example 100)", `
{FC:{c:\`\`\`}
{c:\`\`\`}}
`)

  test("Fenced code blocks (example 101)", `
 {FC:{c:\`\`\`}
{cT: aaa
aaa}
{c:\`\`\`}}
`)

  test("Fenced code blocks (example 102)", `
  {FC:{c:\`\`\`}
{cT:aaa
  aaa
aaa}
  {c:\`\`\`}}
`)

  test("Fenced code blocks (example 103)", `
   {FC:{c:\`\`\`}
{cT:   aaa
    aaa
  aaa}
   {c:\`\`\`}}
`)

  test("Fenced code blocks (example 104)", `
    {CB:{cT:\`\`\`
}    {cT:aaa
}    {cT:\`\`\`}}
`)

  test("Fenced code blocks (example 105)", `
{FC:{c:\`\`\`}
{cT:aaa}
  {c:\`\`\`}}
`)

  test("Fenced code blocks (example 106)", `
   {FC:{c:\`\`\`}
{cT:aaa}
  {c:\`\`\`}}
`)

  test("Fenced code blocks (example 107)", `
{FC:{c:\`\`\`}
{cT:aaa
    \`\`\`
}}`)

  test("Fenced code blocks (example 108)", `
{P:{C:{c:\`\`\`} {c:\`\`\`}}
aaa}
`)

  test("Fenced code blocks (example 109)", `
{FC:{c:~~~~~~}
{cT:aaa
~~~ ~~
}}`)

  test("Fenced code blocks (example 110)", `
{P:foo}
{FC:{c:\`\`\`}
{cT:bar}
{c:\`\`\`}}
{P:baz}
`)

  test("Fenced code blocks (example 111)", `
{SH2:foo
{h:---}}
{FC:{c:~~~}
{cT:bar}
{c:~~~}}
{H1:{h:#} baz}
`)

  test("Fenced code blocks (example 112)", `
{FC:{c:\`\`\`}{cI:ruby}
{cT:def foo(x)
  return 3
end}
{c:\`\`\`}}
`)

  test("Fenced code blocks (example 113)", `
{FC:{c:~~~~}    {cI:ruby startline=3 $%@#$}
{cT:def foo(x)
  return 3
end}
{c:~~~~~~~}}
`)

  test("Fenced code blocks (example 114)", `
{FC:{c:\`\`\`\`}{cI:;}
{c:\`\`\`\`}}
`)

  test("Fenced code blocks (example 115)", `
{P:{C:{c:\`\`\`} aa {c:\`\`\`}}
foo}
`)

  test("Fenced code blocks (example 116)", `
{FC:{c:~~~} {cI:aa \`\`\` ~~~}
{cT:foo}
{c:~~~}}
`)

  test("Fenced code blocks (example 117)", `
{FC:{c:\`\`\`}
{cT:\`\`\` aaa}
{c:\`\`\`}}
`)

  test("HTML blocks (example 118)", `
{HB:<table><tr><td>
<pre>
**Hello**,}

{P:{Em:{e:_}world{e:_}}.
{HT:</pre>}}
{HB:</td></tr></table>}
`)

  test("HTML blocks (example 119)", `
{HB:<table>
  <tr>
    <td>
           hi
    </td>
  </tr>
</table>}

{P:okay.}
`)

  test("HTML blocks (example 120)", `
 {HB:<div>
  *hello*
         <foo><a>}
`)

  test("HTML blocks (example 121)", `
{HB:</div>
*foo*}
`)

  test("HTML blocks (example 122)", `
{HB:<DIV CLASS="foo">}

{P:{Em:{e:*}Markdown{e:*}}}

{HB:</DIV>}
`)

  test("HTML blocks (example 123)", `
{HB:<div id="foo"
  class="bar">
</div>}
`)

  test("HTML blocks (example 124)", `
{HB:<div id="foo" class="bar
  baz">
</div>}
`)

  test("HTML blocks (example 125)", `
{HB:<div>
*foo*}

{P:{Em:{e:*}bar{e:*}}}
`)

  test("HTML blocks (example 126)", `
{HB:<div id="foo"
*hi*}
`)

  test("HTML blocks (example 127)", `
{HB:<div class
foo}
`)

  test("HTML blocks (example 128)", `
{HB:<div *???-&&&-<---
*foo*}
`)

  test("HTML blocks (example 129)", `
{HB:<div><a href="bar">*foo*</a></div>}
`)

  test("HTML blocks (example 130)", `
{HB:<table><tr><td>
foo
</td></tr></table>}
`)

  test("HTML blocks (example 131)", `
{HB:<div></div>
\`\`\` c
int x = 33;
x\`\`\`}
`)

  test("HTML blocks (example 132)", `
{HB:<a href="foo">
*bar*
</a>}
`)

  test("HTML blocks (example 133)", `
{HB:<Warning>
*bar*
</Warning>}
`)

  test("HTML blocks (example 134)", `
{HB:<i class="foo">
*bar*
</i>}
`)

  test("HTML blocks (example 135)", `
{HB:</ins>
*bar*}
`)

  test("HTML blocks (example 136)", `
{HB:<del>
*foo*
</del>}
`)

  test("HTML blocks (example 137)", `
{HB:<del>}

{P:{Em:{e:*}foo{e:*}}}

{HB:</del>}
`)

  test("HTML blocks (example 138)", `
{P:{HT:<del>}{Em:{e:*}foo{e:*}}{HT:</del>}}
`)

  test("HTML blocks (example 139)", `
{HB:<pre language="haskell"><code>
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
</code></pre>}
{P:okay}
`)

  test("HTML blocks (example 140)", `
{HB:<script type="text/javascript">
// JavaScript example

document.getElementById("demo").innerHTML = "Hello JavaScript!";
</script>}
{P:okay}
`)

  test("HTML blocks (example 141)", `
{HB:<style
  type="text/css">
h1 [color:red;]

p [color:blue;]
</style>}
{P:okay}
`)

  test("HTML blocks (example 142)", `
{HB:<style
  type="text/css">

foo
}`)

  test("HTML blocks (example 143)", `
{Q:{q:>} {HB:<div>
{q:>} foo}}

{P:bar}
`)

  test("HTML blocks (example 144)", `
{BL:{LI:{l:-} {HB:<div>}}
{LI:{l:-} {P:foo}}}
`)

  test("HTML blocks (example 145)", `
{HB:<style>p[color:red;]</style>}
{P:{Em:{e:*}foo{e:*}}}
`)

  test("HTML blocks (example 146)", `
{CMB:<!-- foo -->*bar*}
{P:{Em:{e:*}baz{e:*}}}
`)

  test("HTML blocks (example 147)", `
{HB:<script>
foo
</script>1. *bar*}
`)

  test("HTML blocks (example 148)", `
{CMB:<!-- Foo

bar
   baz -->}
{P:okay}
`)

  test("HTML blocks (example 149)", `
{PI:<?php

  echo '>';

?>}
{P:okay}
`)

  test("HTML blocks (example 150)", `
{HB:<!DOCTYPE html>}
`)

  test("HTML blocks (example 151)", `
{HB:<![CDATA[
function matchwo(a,b)
[
  if (a < b && a < 0) then [
    return 1;

  ] else [

    return 0;
  ]
]
]]>}
{P:okay}
`)

  test("HTML blocks (example 152)", `
  {CMB:<!-- foo -->}

    {CB:{cT:<!-- foo -->}}
`)

  test("HTML blocks (example 153)", `
  {HB:<div>}

    {CB:{cT:<div>}}
`)

  test("HTML blocks (example 154)", `
{P:Foo}
{HB:<div>
bar
</div>}
`)

  test("HTML blocks (example 155)", `
{HB:<div>
bar
</div>
*foo*}
`)

  test("HTML blocks (example 156)", `
{P:Foo
{HT:<a href="bar">}
baz}
`)

  test("HTML blocks (example 157)", `
{HB:<div>}

{P:{Em:{e:*}Emphasized{e:*}} text.}

{HB:</div>}
`)

  test("HTML blocks (example 158)", `
{HB:<div>
*Emphasized* text.
</div>}
`)

  test("HTML blocks (example 159)", `
{HB:<table>}

{HB:<tr>}

{HB:<td>
Hi
</td>}

{HB:</tr>}

{HB:</table>}
`)

  test("HTML blocks (example 160)", `
{HB:<table>}

  {HB:<tr>}

    {CB:{cT:<td>
}    {cT:  Hi
}    {cT:</td>}}

  {HB:</tr>}

{HB:</table>}
`)

  test("Link reference definitions (example 161)", `
{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 162)", `
   {LR:{LL:[foo]}{L::} 
      {URL:/url}  
           {LT:'the title'}  }

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 163)", `
{LR:{LL:[Foo*bar\\]]}{L::}{URL:my_(url)} {LT:'title (with parens)'}}

{P:{Ln:{L:[}Foo*bar{Esc:\\]}{L:]}}}
`)

  test("Link reference definitions (example 164)", `
{LR:{LL:[Foo bar]}{L::}
{URL:<my url>}
{LT:'title'}}

{P:{Ln:{L:[}Foo bar{L:]}}}
`)

  test("Link reference definitions (example 165)", `
{LR:{LL:[foo]}{L::} {URL:/url} {LT:'
title
line1
line2
'}}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 166)", `
{P:{Ln:{L:[}foo{L:]}}: /url 'title}

{P:with blank line'}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 167)", `
{LR:{LL:[foo]}{L::}
{URL:/url}}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 168)", `
{P:{Ln:{L:[}foo{L:]}}:}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 169)", `
{LR:{LL:[foo]}{L::} {URL:<>}}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 170)", `
{P:{Ln:{L:[}foo{L:]}}: {HT:<bar>}(baz)}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 171)", `
{LR:{LL:[foo]}{L::} {URL:/url\`bar\`*baz} {LT:"foo\\"bar\\baz"}}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 172)", `
{P:{Ln:{L:[}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:url}}
`)

  test("Link reference definitions (example 173)", `
{P:{Ln:{L:[}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:first}}
{LR:{LL:[foo]}{L::} {URL:second}}
`)

  test("Link reference definitions (example 174)", `
{LR:{LL:[FOO]}{L::} {URL:/url}}

{P:{Ln:{L:[}Foo{L:]}}}
`)

  test("Link reference definitions (example 175)", `
{LR:{LL:[ΑΓΩ]}{L::} {URL:/φου}}

{P:{Ln:{L:[}αγω{L:]}}}
`)

  test("Link reference definitions (example 176)", `
{LR:{LL:[foo]}{L::} {URL:/url}}
`)

  test("Link reference definitions (example 177)", `
{LR:{LL:[
foo
]}{L::} {URL:/url}}
{P:bar}
`)

  test("Link reference definitions (example 178)", `
{P:{Ln:{L:[}foo{L:]}}: /url "title" ok}
`)

  test("Link reference definitions (example 179)", `
{LR:{LL:[foo]}{L::} {URL:/url}}
{P:"title" ok}
`)

  test("Link reference definitions (example 180)", `
    {CB:{cT:[foo]: /url "title"}}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 181)", `
{FC:{c:\`\`\`}
{cT:[foo]: /url}
{c:\`\`\`}}

{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 182)", `
{P:Foo
{Ln:{L:[}bar{L:]}}: /baz}

{P:{Ln:{L:[}bar{L:]}}}
`)

  test("Link reference definitions (example 183)", `
{H1:{h:#} {Ln:{L:[}Foo{L:]}}}
{LR:{LL:[foo]}{L::} {URL:/url}}
{Q:{q:>} {P:bar}}
`)

  test("Link reference definitions (example 184)", `
{LR:{LL:[foo]}{L::} {URL:/url}}
{SH1:bar
{h:===}}
{P:{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 185)", `
{LR:{LL:[foo]}{L::} {URL:/url}}
{P:===
{Ln:{L:[}foo{L:]}}}
`)

  test("Link reference definitions (example 186)", `
{LR:{LL:[foo]}{L::} {URL:/foo-url} {LT:"foo"}}
{LR:{LL:[bar]}{L::} {URL:/bar-url}
  {LT:"bar"}}
{LR:{LL:[baz]}{L::} {URL:/baz-url}}

{P:{Ln:{L:[}foo{L:]}},
{Ln:{L:[}bar{L:]}},
{Ln:{L:[}baz{L:]}}}
`)

  test("Link reference definitions (example 187)", `
{P:{Ln:{L:[}foo{L:]}}}

{Q:{q:>} {LR:{LL:[foo]}{L::} {URL:/url}}}
`)

  test("Link reference definitions (example 188)", `
{LR:{LL:[foo]}{L::} {URL:/url}}
`)

  test("Paragraphs (example 189)", `
{P:aaa}

{P:bbb}
`)

  test("Paragraphs (example 190)", `
{P:aaa
bbb}

{P:ccc
ddd}
`)

  test("Paragraphs (example 191)", `
{P:aaa}


{P:bbb}
`)

  test("Paragraphs (example 192)", `
  {P:aaa
 bbb}
`)

  test("Paragraphs (example 193)", `
{P:aaa
             bbb
                                       ccc}
`)

  test("Paragraphs (example 194)", `
   {P:aaa
bbb}
`)

  test("Paragraphs (example 195)", `
    {CB:{cT:aaa}}
{P:bbb}
`)

  test("Paragraphs (example 196)", `
{P:aaa{BR:     
}bbb     }
`)

  test("Blank lines (example 197)", `
  

{P:aaa}
  

{H1:{h:#} aaa}

  
`)

  test("Block quotes (example 198)", `
{Q:{q:>} {H1:{h:#} Foo}
{q:>} {P:bar
{q:>} baz}}
`)

  test("Block quotes (example 199)", `
{Q:{q:>}{H1:{h:#} Foo}
{q:>}{P:bar
{q:>} baz}}
`)

  test("Block quotes (example 200)", `
   {Q:{q:>} {H1:{h:#} Foo}
   {q:>} {P:bar
 {q:>} baz}}
`)

  test("Block quotes (example 201)", `
    {CB:{cT:> # Foo
}    {cT:> bar
}    {cT:> baz}}
`)

  test("Block quotes (example 202)", `
{Q:{q:>} {H1:{h:#} Foo}
{q:>} {P:bar
baz}}
`)

  test("Block quotes (example 203)", `
{Q:{q:>} {P:bar
baz
{q:>} foo}}
`)

  test("Block quotes (example 204)", `
{Q:{q:>} {P:foo}}
{HR:---}
`)

  test("Block quotes (example 205)", `
{Q:{q:>} {BL:{LI:{l:-} {P:foo}}}}
{BL:{LI:{l:-} {P:bar}}}
`)

  test("Block quotes (example 206)", `
{Q:{q:>}     {CB:{cT:foo}}}
    {CB:{cT:bar}}
`)

  test("Block quotes (example 207)", `
{Q:{q:>} {FC:{c:\`\`\`}}}
{P:foo}
{FC:{c:\`\`\`}
}`)

  test("Block quotes (example 208)", `
{Q:{q:>} {P:foo
    - bar}}
`)

  test("Block quotes (example 209)", `
{Q:{q:>}{P:}}
`)

  test("Block quotes (example 210)", `
{Q:{q:>}{P:}
{q:>}  
{q:>} }
`)

  test("Block quotes (example 211)", `
{Q:{q:>}{P:
{q:>} foo}
{q:>}  }
`)

  test("Block quotes (example 212)", `
{Q:{q:>} {P:foo}}

{Q:{q:>} {P:bar}}
`)

  test("Block quotes (example 213)", `
{Q:{q:>} {P:foo
{q:>} bar}}
`)

  test("Block quotes (example 214)", `
{Q:{q:>} {P:foo}
{q:>}
{q:>} {P:bar}}
`)

  test("Block quotes (example 215)", `
{P:foo}
{Q:{q:>} {P:bar}}
`)

  test("Block quotes (example 216)", `
{Q:{q:>} {P:aaa}}
{HR:***}
{Q:{q:>} {P:bbb}}
`)

  test("Block quotes (example 217)", `
{Q:{q:>} {P:bar
baz}}
`)

  test("Block quotes (example 218)", `
{Q:{q:>} {P:bar}}

{P:baz}
`)

  test("Block quotes (example 219)", `
{Q:{q:>} {P:bar}
{q:>}}
{P:baz}
`)

  test("Block quotes (example 220)", `
{Q:{q:>} {Q:{q:>} {Q:{q:>} {P:foo
bar}}}}
`)

  test("Block quotes (example 221)", `
{Q:{q:>}{Q:{q:>}{Q:{q:>} {P:foo
{q:>} bar
{q:>}{q:>}baz}}}}
`)

  test("Block quotes (example 222)", `
{Q:{q:>}     {CB:{cT:code}}}

{Q:{q:>}    {P:not code}}
`)

  test("List items (example 223)", `
{P:A paragraph
with two lines.}

    {CB:{cT:indented code}}

{Q:{q:>} {P:A block quote.}}
`)

  test("List items (example 224)", `
{OL:{LI:{l:1.}  {P:A paragraph
    with two lines.}

        {CB:{cT:indented code}}

    {Q:{q:>} {P:A block quote.}}}}
`)

  test("List items (example 225)", `
{BL:{LI:{l:-} {P:one}}}

 {P:two}
`)

  test("List items (example 226)", `
{BL:{LI:{l:-} {P:one}

  {P:two}}}
`)

  test("List items (example 227)", `
{BL:{LI: {l:-}    {P:one}}}

    {CB:{cT: two}}
`)

  test("List items (example 228)", `
{BL:{LI: {l:-}    {P:one}

      {P:two}}}
`)

  test("List items (example 229)", `
   {Q:{q:>} {Q:{q:>} {OL:{LI:{l:1.}  {P:one}
{q:>}{q:>}
{q:>}{q:>}     {P:two}}}}}
`)

  test("List items (example 230)", `
{Q:{q:>}{Q:{q:>}{BL:{LI:{l:-} {P:one}
{q:>}{q:>}}}
  {q:>}  {q:>} {P:two}}}
`)

  test("List items (example 231)", `
{P:-one}

{P:2.two}
`)

  test("List items (example 232)", `
{BL:{LI:{l:-} {P:foo}


  {P:bar}}}
`)

  test("List items (example 233)", `
{OL:{LI:{l:1.}  {P:foo}

    {FC:{c:\`\`\`}
    {cT:bar}
    {c:\`\`\`}}

    {P:baz}

    {Q:{q:>} {P:bam}}}}
`)

  test("List items (example 234)", `
{BL:{LI:{l:-} {P:Foo}

      {CB:{cT:bar


}      {cT:baz}}}}
`)

  test("List items (example 235)", `
{OL:{LI:{l:123456789.} {P:ok}}}
`)

  test("List items (example 236)", `
{P:1234567890. not ok}
`)

  test("List items (example 237)", `
{OL:{LI:{l:0.} {P:ok}}}
`)

  test("List items (example 238)", `
{OL:{LI:{l:003.} {P:ok}}}
`)

  test("List items (example 239)", `
{P:-1. not ok}
`)

  test("List items (example 240)", `
{BL:{LI:{l:-} {P:foo}

      {CB:{cT:bar}}}}
`)

  test("List items (example 241)", `
{OL:{LI:  {l:10.}  {P:foo}

           {CB:{cT:bar}}}}
`)

  test("List items (example 242)", `
    {CB:{cT:indented code}}

{P:paragraph}

    {CB:{cT:more code}}
`)

  test("List items (example 243)", `
{OL:{LI:{l:1.}     {CB:{cT:indented code}}

   {P:paragraph}

       {CB:{cT:more code}}}}
`)

  test("List items (example 244)", `
{OL:{LI:{l:1.}     {CB:{cT: indented code}}

   {P:paragraph}

       {CB:{cT:more code}}}}
`)

  test("List items (example 245)", `
   {P:foo}

{P:bar}
`)

  test("List items (example 246)", `
{BL:{LI:{l:-}    {P:foo}}}

  {P:bar}
`)

  test("List items (example 247)", `
{BL:{LI:{l:-}  {P:foo}

   {P:bar}}}
`)

  test("List items (example 248)", `
{BL:{LI:{l:-}{P:
  foo}}
{LI:{l:-}{P:}
  {FC:{c:\`\`\`}
 {cT: bar}
  {c:\`\`\`}}}
{LI:{l:-}{P:
      baz}}}
`)

  test("List items (example 249)", `
{BL:{LI:{l:-}   {P:
  foo}}}
`)

  test("List items (example 250)", `
{BL:{LI:{l:-}{P:}

  {P:foo}}}
`)

  test("List items (example 251)", `
{BL:{LI:{l:-} {P:foo}}
{LI:{l:-}{P:}}
{LI:{l:-} {P:bar}}}
`)

  test("List items (example 252)", `
{BL:{LI:{l:-} {P:foo}}
{LI:{l:-}   {P:}}
{LI:{l:-} {P:bar}}}
`)

  test("List items (example 253)", `
{OL:{LI:{l:1.} {P:foo}}
{LI:{l:2.}{P:}}
{LI:{l:3.} {P:bar}}}
`)

  test("List items (example 254)", `
{BL:{LI:{l:*}{P:}}}
`)

  test("List items (example 255)", `
{P:foo
*}

{P:foo
1.}
`)

  test("List items (example 256)", `
{OL:{LI: {l:1.}  {P:A paragraph
     with two lines.}

         {CB:{cT:indented code}}

     {Q:{q:>} {P:A block quote.}}}}
`)

  test("List items (example 257)", `
{OL:{LI:  {l:1.}  {P:A paragraph
      with two lines.}

          {CB:{cT:indented code}}

      {Q:{q:>} {P:A block quote.}}}}
`)

  test("List items (example 258)", `
{OL:{LI:   {l:1.}  {P:A paragraph
       with two lines.}

           {CB:{cT:indented code}}

       {Q:{q:>} {P:A block quote.}}}}
`)

  test("List items (example 259)", `
    {CB:{cT:1.  A paragraph
}    {cT:    with two lines.

}    {cT:        indented code

}    {cT:    > A block quote.}}
`)

  test("List items (example 260)", `
{OL:{LI:  {l:1.}  {P:A paragraph
with two lines.}

          {CB:{cT:indented code}}

      {Q:{q:>} {P:A block quote.}}}}
`)

  test("List items (example 261)", `
{OL:{LI:  {l:1.}  {P:A paragraph
    with two lines.}}}
`)

  test("List items (example 262)", `
{Q:{q:>} {OL:{LI:{l:1.} {Q:{q:>} {P:Blockquote
continued here.}}}}}
`)

  test("List items (example 263)", `
{Q:{q:>} {OL:{LI:{l:1.} {Q:{q:>} {P:Blockquote
{q:>} continued here.}}}}}
`)

  test("List items (example 264)", `
{BL:{LI:{l:-} {P:foo}
  {BL:{LI:{l:-} {P:bar}
    {BL:{LI:{l:-} {P:baz}
      {BL:{LI:{l:-} {P:boo}}}}}}}}}
`)

  test("List items (example 265)", `
{BL:{LI:{l:-} {P:foo}}
{LI: {l:-} {P:bar}}
{LI:  {l:-} {P:baz}}
{LI:   {l:-} {P:boo}}}
`)

  test("List items (example 266)", `
{OL:{LI:{l:10)} {P:foo}
    {BL:{LI:{l:-} {P:bar}}}}}
`)

  test("List items (example 267)", `
{OL:{LI:{l:10)} {P:foo}}}
{BL:{LI:   {l:-} {P:bar}}}
`)

  test("List items (example 268)", `
{BL:{LI:{l:-} {BL:{LI:{l:-} {P:foo}}}}}
`)

  test("List items (example 269)", `
{OL:{LI:{l:1.} {BL:{LI:{l:-} {OL:{LI:{l:2.} {P:foo}}}}}}}
`)

  test("List items (example 270)", `
{BL:{LI:{l:-} {H1:{h:#} Foo}}
{LI:{l:-} {SH2:Bar
  {h:---}}
  {P:baz}}}
`)

  test("Lists (example 271)", `
{BL:{LI:{l:-} {P:foo}}
{LI:{l:-} {P:bar}}}
{BL:{LI:{l:+} {P:baz}}}
`)

  test("Lists (example 272)", `
{OL:{LI:{l:1.} {P:foo}}
{LI:{l:2.} {P:bar}}}
{OL:{LI:{l:3)} {P:baz}}}
`)

  test("Lists (example 273)", `
{P:Foo}
{BL:{LI:{l:-} {P:bar}}
{LI:{l:-} {P:baz}}}
`)

  test("Lists (example 274)", `
{P:The number of windows in my house is
14.  The number of doors is 6.}
`)

  test("Lists (example 275)", `
{P:The number of windows in my house is}
{OL:{LI:{l:1.}  {P:The number of doors is 6.}}}
`)

  test("Lists (example 276)", `
{BL:{LI:{l:-} {P:foo}}

{LI:{l:-} {P:bar}}


{LI:{l:-} {P:baz}}}
`)

  test("Lists (example 277)", `
{BL:{LI:{l:-} {P:foo}
  {BL:{LI:{l:-} {P:bar}
    {BL:{LI:{l:-} {P:baz}


      {P:bim}}}}}}}
`)

  test("Lists (example 278)", `
{BL:{LI:{l:-} {P:foo}}
{LI:{l:-} {P:bar}}}

{CMB:<!-- -->}

{BL:{LI:{l:-} {P:baz}}
{LI:{l:-} {P:bim}}}
`)

  test("Lists (example 279)", `
{BL:{LI:{l:-}   {P:foo}

    {P:notcode}}

{LI:{l:-}   {P:foo}}}

{CMB:<!-- -->}

    {CB:{cT:code}}
`)

  test("Lists (example 280)", `
{BL:{LI:{l:-} {P:a}}
{LI: {l:-} {P:b}}
{LI:  {l:-} {P:c}}
{LI:   {l:-} {P:d}}
{LI:  {l:-} {P:e}}
{LI: {l:-} {P:f}}
{LI:{l:-} {P:g}}}
`)

  test("Lists (example 281)", `
{OL:{LI:{l:1.} {P:a}}

{LI:  {l:2.} {P:b}}

{LI:   {l:3.} {P:c}}}
`)

  test("Lists (example 282)", `
{BL:{LI:{l:-} {P:a}}
{LI: {l:-} {P:b}}
{LI:  {l:-} {P:c}}
{LI:   {l:-} {P:d
    - e}}}
`)

  test("Lists (example 283)", `
{OL:{LI:{l:1.} {P:a}}

{LI:  {l:2.} {P:b}}}

    {CB:{cT:3. c}}
`)

  test("Lists (example 284)", `
{BL:{LI:{l:-} {P:a}}
{LI:{l:-} {P:b}}

{LI:{l:-} {P:c}}}
`)

  test("Lists (example 285)", `
{BL:{LI:{l:*} {P:a}}
{LI:{l:*}{P:}}

{LI:{l:*} {P:c}}}
`)

  test("Lists (example 286)", `
{BL:{LI:{l:-} {P:a}}
{LI:{l:-} {P:b}

  {P:c}}
{LI:{l:-} {P:d}}}
`)

  test("Lists (example 287)", `
{BL:{LI:{l:-} {P:a}}
{LI:{l:-} {P:b}

  {LR:{LL:[ref]}{L::} {URL:/url}}}
{LI:{l:-} {P:d}}}
`)

  test("Lists (example 288)", `
{BL:{LI:{l:-} {P:a}}
{LI:{l:-} {FC:{c:\`\`\`}
  {cT:b

}
  {c:\`\`\`}}}
{LI:{l:-} {P:c}}}
`)

  test("Lists (example 289)", `
{BL:{LI:{l:-} {P:a}
  {BL:{LI:{l:-} {P:b}

    {P:c}}}}
{LI:{l:-} {P:d}}}
`)

  test("Lists (example 290)", `
{BL:{LI:{l:*} {P:a}
  {Q:{q:>} {P:b}
  {q:>}}}
{LI:{l:*} {P:c}}}
`)

  test("Lists (example 291)", `
{BL:{LI:{l:-} {P:a}
  {Q:{q:>} {P:b}}
  {FC:{c:\`\`\`}
  {cT:c}
  {c:\`\`\`}}}
{LI:{l:-} {P:d}}}
`)

  test("Lists (example 292)", `
{BL:{LI:{l:-} {P:a}}}
`)

  test("Lists (example 293)", `
{BL:{LI:{l:-} {P:a}
  {BL:{LI:{l:-} {P:b}}}}}
`)

  test("Lists (example 294)", `
{OL:{LI:{l:1.} {FC:{c:\`\`\`}
   {cT:foo}
   {c:\`\`\`}}

   {P:bar}}}
`)

  test("Lists (example 295)", `
{BL:{LI:{l:*} {P:foo}
  {BL:{LI:{l:*} {P:bar}}}

  {P:baz}}}
`)

  test("Lists (example 296)", `
{BL:{LI:{l:-} {P:a}
  {BL:{LI:{l:-} {P:b}}
  {LI:{l:-} {P:c}}}}

{LI:{l:-} {P:d}
  {BL:{LI:{l:-} {P:e}}
  {LI:{l:-} {P:f}}}}}
`)

  test("Backslash escapes (example 297)", `
{P:{Esc:\\!}{Esc:\\"}{Esc:\\#}{Esc:\\$}{Esc:\\%}{Esc:\\&}{Esc:\\'}{Esc:\\(}{Esc:\\)}{Esc:\\*}{Esc:\\+}{Esc:\\,}{Esc:\\-}{Esc:\\.}{Esc:\\/}{Esc:\\:}{Esc:\\;}{Esc:\\<}{Esc:\\=}{Esc:\\>}{Esc:\\?}{Esc:\\@}{Esc:\\[}{Esc:\\\\}{Esc:\\]}{Esc:\\^}{Esc:\\_}{Esc:\\\`}{Esc:\\|}{Esc:\\~}}
`)

  test("Backslash escapes (example 299)", `
{P:\\   \\A\\a\\ \\3\\φ\\«}
`)

  test("Backslash escapes (example 300)", `
{P:{Esc:\\*}not emphasized*
{Esc:\\<}br/> not a tag
{Esc:\\[}not a link](/foo)
{Esc:\\\`}not code\`
1{Esc:\\.} not a list
{Esc:\\*} not a list
{Esc:\\#} not a heading
{Esc:\\[}foo]: /url "not a reference"
{Esc:\\&}ouml; not a character entity}
`)

  test("Backslash escapes (example 301)", `
{P:{Esc:\\\\}{Em:{e:*}emphasis{e:*}}}
`)

  test("Backslash escapes (example 302)", `
{P:foo{BR:\\
}bar}
`)

  test("Backslash escapes (example 303)", `
{P:{C:{c:\`\`} \\[\\\` {c:\`\`}}}
`)

  test("Backslash escapes (example 304)", `
    {CB:{cT:\\[\\]}}
`)

  test("Backslash escapes (example 305)", `
{FC:{c:~~~}
{cT:\\[\\]}
{c:~~~}}
`)

  test("Backslash escapes (example 306)", `
{P:{Al:{L:<}{URL:http://example.com?find=\\*}{L:>}}}
`)

  test("Backslash escapes (example 307)", `
{HB:<a href="/bar\\/)">}
`)

  test("Backslash escapes (example 308)", `
{P:{Ln:{L:[}foo{L:]}{L:(}{URL:/bar\\*} {LT:"ti\\*tle"}{L:)}}}
`)

  test("Backslash escapes (example 309)", `
{P:{Ln:{L:[}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/bar\\*} {LT:"ti\\*tle"}}
`)

  test("Backslash escapes (example 310)", `
{FC:{c:\`\`\`} {cI:foo\\+bar}
{cT:foo}
{c:\`\`\`}}
`)

  test("Inlines (example 298)", `
{P:{C:{c:\`}hi{c:\`}}lo\`}
`)

  test("Entity and numeric character references (example 311)", `
{P:{Ent:&nbsp;} {Ent:&amp;} {Ent:&copy;} {Ent:&AElig;} {Ent:&Dcaron;}
{Ent:&frac34;} {Ent:&HilbertSpace;} {Ent:&DifferentialD;}
{Ent:&ClockwiseContourIntegral;} {Ent:&ngE;}}
`)

  test("Entity and numeric character references (example 312)", `
{P:{Ent:&#35;} {Ent:&#1234;} {Ent:&#992;} {Ent:&#0;}}
`)

  test("Entity and numeric character references (example 313)", `
{P:{Ent:&#X22;} {Ent:&#XD06;} {Ent:&#xcab;}}
`)

  // Our implementation doesn't check for invalid entity names
  test("Entity and numeric character references (example 314)", `
{P:&nbsp {Ent:&x;} &#; &#x;
{Ent:&#987654321;}
&#abcdef0;
{Ent:&ThisIsNotDefined;} &hi?;}
`)

  test("Entity and numeric character references (example 315)", `
{P:&copy}
`)

  // Again, not checking for made-up entity names.
  test("Entity and numeric character references (example 316)", `
{P:{Ent:&MadeUpEntity;}}
`)

  test("Entity and numeric character references (example 317)", `
{HB:<a href="&ouml;&ouml;.html">}
`)

  test("Entity and numeric character references (example 318)", `
{P:{Ln:{L:[}foo{L:]}{L:(}{URL:/f&ouml;&ouml;} {LT:"f&ouml;&ouml;"}{L:)}}}
`)

  test("Entity and numeric character references (example 319)", `
{P:{Ln:{L:[}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/f&ouml;&ouml;} {LT:"f&ouml;&ouml;"}}
`)

  test("Entity and numeric character references (example 320)", `
{FC:{c:\`\`\`} {cI:f&ouml;&ouml;}
{cT:foo}
{c:\`\`\`}}
`)

  test("Entity and numeric character references (example 321)", `
{P:{C:{c:\`}f&ouml;&ouml;{c:\`}}}
`)

  test("Entity and numeric character references (example 322)", `
    {CB:{cT:f&ouml;f&ouml;}}
`)

  test("Entity and numeric character references (example 323)", `
{P:{Ent:&#42;}foo{Ent:&#42;}
{Em:{e:*}foo{e:*}}}
`)

  test("Entity and numeric character references (example 324)", `
{P:{Ent:&#42;} foo}

{BL:{LI:{l:*} {P:foo}}}
`)

  test("Entity and numeric character references (example 325)", `
{P:foo{Ent:&#10;}{Ent:&#10;}bar}
`)

  test("Entity and numeric character references (example 326)", `
{P:{Ent:&#9;}foo}
`)

  test("Entity and numeric character references (example 327)", `
{P:{Ln:{L:[}a{L:]}}(url {Ent:&quot;}tit{Ent:&quot;})}
`)

  test("Code spans (example 328)", `
{P:{C:{c:\`}foo{c:\`}}}
`)

  test("Code spans (example 329)", `
{P:{C:{c:\`\`} foo \` bar {c:\`\`}}}
`)

  test("Code spans (example 330)", `
{P:{C:{c:\`} \`\` {c:\`}}}
`)

  test("Code spans (example 331)", `
{P:{C:{c:\`}  \`\`  {c:\`}}}
`)

  test("Code spans (example 332)", `
{P:{C:{c:\`} a{c:\`}}}
`)

  test("Code spans (example 333)", `
{P:{C:{c:\`} b {c:\`}}}
`)

  test("Code spans (example 334)", `
{P:{C:{c:\`} {c:\`}}
{C:{c:\`}  {c:\`}}}
`)

  test("Code spans (example 335)", `
{P:{C:{c:\`\`}
foo
bar  
baz
{c:\`\`}}}
`)

  test("Code spans (example 336)", `
{P:{C:{c:\`\`}
foo 
{c:\`\`}}}
`)

  test("Code spans (example 337)", `
{P:{C:{c:\`}foo   bar 
baz{c:\`}}}
`)

  test("Code spans (example 338)", `
{P:{C:{c:\`}foo\\{c:\`}}bar\`}
`)

  test("Code spans (example 339)", `
{P:{C:{c:\`\`}foo\`bar{c:\`\`}}}
`)

  test("Code spans (example 340)", `
{P:{C:{c:\`} foo \`\` bar {c:\`}}}
`)

  test("Code spans (example 341)", `
{P:*foo{C:{c:\`}*{c:\`}}}
`)

  test("Code spans (example 342)", `
{P:[not a {C:{c:\`}link](/foo{c:\`}})}
`)

  test("Code spans (example 343)", `
{P:{C:{c:\`}<a href="{c:\`}}">\`}
`)

  test("Code spans (example 344)", `
{P:{HT:<a href="\`">}\`}
`)

  test("Code spans (example 345)", `
{P:{C:{c:\`}<http://foo.bar.{c:\`}}baz>\`}
`)

  test("Code spans (example 346)", `
{P:{Al:{L:<}{URL:http://foo.bar.\`baz}{L:>}}\`}
`)

  test("Code spans (example 347)", `
{P:\`\`\`foo\`\`}
`)

  test("Code spans (example 348)", `
{P:\`foo}
`)

  test("Code spans (example 349)", `
{P:\`foo{C:{c:\`\`}bar{c:\`\`}}}
`)

  test("Emphasis and strong emphasis (example 350)", `
{P:{Em:{e:*}foo bar{e:*}}}
`)

  test("Emphasis and strong emphasis (example 351)", `
{P:a * foo bar*}
`)

  test("Emphasis and strong emphasis (example 352)", `
{P:a*"foo"*}
`)

  test("Emphasis and strong emphasis (example 353)", `
{P:* a *}
`)

  test("Emphasis and strong emphasis (example 354)", `
{P:foo{Em:{e:*}bar{e:*}}}
`)

  test("Emphasis and strong emphasis (example 355)", `
{P:5{Em:{e:*}6{e:*}}78}
`)

  test("Emphasis and strong emphasis (example 356)", `
{P:{Em:{e:_}foo bar{e:_}}}
`)

  test("Emphasis and strong emphasis (example 357)", `
{P:_ foo bar_}
`)

  test("Emphasis and strong emphasis (example 358)", `
{P:a_"foo"_}
`)

  test("Emphasis and strong emphasis (example 359)", `
{P:foo_bar_}
`)

  test("Emphasis and strong emphasis (example 360)", `
{P:5_6_78}
`)

  test("Emphasis and strong emphasis (example 361)", `
{P:пристаням_стремятся_}
`)

  test("Emphasis and strong emphasis (example 362)", `
{P:aa_"bb"_cc}
`)

  test("Emphasis and strong emphasis (example 363)", `
{P:foo-{Em:{e:_}(bar){e:_}}}
`)

  test("Emphasis and strong emphasis (example 364)", `
{P:_foo*}
`)

  test("Emphasis and strong emphasis (example 365)", `
{P:*foo bar *}
`)

  test("Emphasis and strong emphasis (example 366)", `
{P:*foo bar
*}
`)

  test("Emphasis and strong emphasis (example 367)", `
{P:*(*foo)}
`)

  test("Emphasis and strong emphasis (example 368)", `
{P:{Em:{e:*}({Em:{e:*}foo{e:*}}){e:*}}}
`)

  test("Emphasis and strong emphasis (example 369)", `
{P:{Em:{e:*}foo{e:*}}bar}
`)

  test("Emphasis and strong emphasis (example 370)", `
{P:_foo bar _}
`)

  test("Emphasis and strong emphasis (example 371)", `
{P:_(_foo)}
`)

  test("Emphasis and strong emphasis (example 372)", `
{P:{Em:{e:_}({Em:{e:_}foo{e:_}}){e:_}}}
`)

  test("Emphasis and strong emphasis (example 373)", `
{P:_foo_bar}
`)

  test("Emphasis and strong emphasis (example 374)", `
{P:_пристаням_стремятся}
`)

  test("Emphasis and strong emphasis (example 375)", `
{P:{Em:{e:_}foo_bar_baz{e:_}}}
`)

  test("Emphasis and strong emphasis (example 376)", `
{P:{Em:{e:_}(bar){e:_}}.}
`)

  test("Emphasis and strong emphasis (example 377)", `
{P:{St:{e:**}foo bar{e:**}}}
`)

  test("Emphasis and strong emphasis (example 378)", `
{P:** foo bar**}
`)

  test("Emphasis and strong emphasis (example 379)", `
{P:a**"foo"**}
`)

  test("Emphasis and strong emphasis (example 380)", `
{P:foo{St:{e:**}bar{e:**}}}
`)

  test("Emphasis and strong emphasis (example 381)", `
{P:{St:{e:__}foo bar{e:__}}}
`)

  test("Emphasis and strong emphasis (example 382)", `
{P:__ foo bar__}
`)

  test("Emphasis and strong emphasis (example 383)", `
{P:__
foo bar__}
`)

  test("Emphasis and strong emphasis (example 384)", `
{P:a__"foo"__}
`)

  test("Emphasis and strong emphasis (example 385)", `
{P:foo__bar__}
`)

  test("Emphasis and strong emphasis (example 386)", `
{P:5__6__78}
`)

  test("Emphasis and strong emphasis (example 387)", `
{P:пристаням__стремятся__}
`)

  test("Emphasis and strong emphasis (example 388)", `
{P:{St:{e:__}foo, {St:{e:__}bar{e:__}}, baz{e:__}}}
`)

  test("Emphasis and strong emphasis (example 389)", `
{P:foo-{St:{e:__}(bar){e:__}}}
`)

  test("Emphasis and strong emphasis (example 390)", `
{P:**foo bar **}
`)

  test("Emphasis and strong emphasis (example 391)", `
{P:**(**foo)}
`)

  test("Emphasis and strong emphasis (example 392)", `
{P:{Em:{e:*}({St:{e:**}foo{e:**}}){e:*}}}
`)

  test("Emphasis and strong emphasis (example 393)", `
{P:{St:{e:**}Gomphocarpus ({Em:{e:*}Gomphocarpus physocarpus{e:*}}, syn.
{Em:{e:*}Asclepias physocarpa{e:*}}){e:**}}}
`)

  test("Emphasis and strong emphasis (example 394)", `
{P:{St:{e:**}foo "{Em:{e:*}bar{e:*}}" foo{e:**}}}
`)

  test("Emphasis and strong emphasis (example 395)", `
{P:{St:{e:**}foo{e:**}}bar}
`)

  test("Emphasis and strong emphasis (example 396)", `
{P:__foo bar __}
`)

  test("Emphasis and strong emphasis (example 397)", `
{P:__(__foo)}
`)

  test("Emphasis and strong emphasis (example 398)", `
{P:{Em:{e:_}({St:{e:__}foo{e:__}}){e:_}}}
`)

  test("Emphasis and strong emphasis (example 399)", `
{P:__foo__bar}
`)

  test("Emphasis and strong emphasis (example 400)", `
{P:__пристаням__стремятся}
`)

  test("Emphasis and strong emphasis (example 401)", `
{P:{St:{e:__}foo__bar__baz{e:__}}}
`)

  test("Emphasis and strong emphasis (example 402)", `
{P:{St:{e:__}(bar){e:__}}.}
`)

  test("Emphasis and strong emphasis (example 403)", `
{P:{Em:{e:*}foo {Ln:{L:[}bar{L:]}{L:(}{URL:/url}{L:)}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 404)", `
{P:{Em:{e:*}foo
bar{e:*}}}
`)

  test("Emphasis and strong emphasis (example 405)", `
{P:{Em:{e:_}foo {St:{e:__}bar{e:__}} baz{e:_}}}
`)

  test("Emphasis and strong emphasis (example 406)", `
{P:{Em:{e:_}foo {Em:{e:_}bar{e:_}} baz{e:_}}}
`)

  test("Emphasis and strong emphasis (example 407)", `
{P:{Em:{e:_}{Em:{e:_}foo{e:_}} bar{e:_}}}
`)

  test("Emphasis and strong emphasis (example 408)", `
{P:{Em:{e:*}foo {Em:{e:*}bar{e:*}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 409)", `
{P:{Em:{e:*}foo {St:{e:**}bar{e:**}} baz{e:*}}}
`)

  test("Emphasis and strong emphasis (example 410)", `
{P:{Em:{e:*}foo{St:{e:**}bar{e:**}}baz{e:*}}}
`)

  test("Emphasis and strong emphasis (example 411)", `
{P:{Em:{e:*}foo**bar{e:*}}}
`)

  test("Emphasis and strong emphasis (example 412)", `
{P:{Em:{e:*}{St:{e:**}foo{e:**}} bar{e:*}}}
`)

  test("Emphasis and strong emphasis (example 413)", `
{P:{Em:{e:*}foo {St:{e:**}bar{e:**}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 414)", `
{P:{Em:{e:*}foo{St:{e:**}bar{e:**}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 415)", `
{P:foo{Em:{e:*}{St:{e:**}bar{e:**}}{e:*}}baz}
`)

  test("Emphasis and strong emphasis (example 416)", `
{P:foo{St:{e:**}{St:{e:**}{St:{e:**}bar{e:**}}{e:**}}{e:**}}***baz}
`)

  test("Emphasis and strong emphasis (example 417)", `
{P:{Em:{e:*}foo {St:{e:**}bar {Em:{e:*}baz{e:*}} bim{e:**}} bop{e:*}}}
`)

  test("Emphasis and strong emphasis (example 418)", `
{P:{Em:{e:*}foo {Ln:{L:[}{Em:{e:*}bar{e:*}}{L:]}{L:(}{URL:/url}{L:)}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 419)", `
{P:** is not an empty emphasis}
`)

  test("Emphasis and strong emphasis (example 420)", `
{P:**** is not an empty strong emphasis}
`)

  test("Emphasis and strong emphasis (example 421)", `
{P:{St:{e:**}foo {Ln:{L:[}bar{L:]}{L:(}{URL:/url}{L:)}}{e:**}}}
`)

  test("Emphasis and strong emphasis (example 422)", `
{P:{St:{e:**}foo
bar{e:**}}}
`)

  test("Emphasis and strong emphasis (example 423)", `
{P:{St:{e:__}foo {Em:{e:_}bar{e:_}} baz{e:__}}}
`)

  test("Emphasis and strong emphasis (example 424)", `
{P:{St:{e:__}foo {St:{e:__}bar{e:__}} baz{e:__}}}
`)

  test("Emphasis and strong emphasis (example 425)", `
{P:{St:{e:__}{St:{e:__}foo{e:__}} bar{e:__}}}
`)

  test("Emphasis and strong emphasis (example 426)", `
{P:{St:{e:**}foo {St:{e:**}bar{e:**}}{e:**}}}
`)

  test("Emphasis and strong emphasis (example 427)", `
{P:{St:{e:**}foo {Em:{e:*}bar{e:*}} baz{e:**}}}
`)

  test("Emphasis and strong emphasis (example 428)", `
{P:{St:{e:**}foo{Em:{e:*}bar{e:*}}baz{e:**}}}
`)

  test("Emphasis and strong emphasis (example 429)", `
{P:{St:{e:**}{Em:{e:*}foo{e:*}} bar{e:**}}}
`)

  test("Emphasis and strong emphasis (example 430)", `
{P:{St:{e:**}foo {Em:{e:*}bar{e:*}}{e:**}}}
`)

  test("Emphasis and strong emphasis (example 431)", `
{P:{St:{e:**}foo {Em:{e:*}bar {St:{e:**}baz{e:**}}
bim{e:*}} bop{e:**}}}
`)

  test("Emphasis and strong emphasis (example 432)", `
{P:{St:{e:**}foo {Ln:{L:[}{Em:{e:*}bar{e:*}}{L:]}{L:(}{URL:/url}{L:)}}{e:**}}}
`)

  test("Emphasis and strong emphasis (example 433)", `
{P:__ is not an empty emphasis}
`)

  test("Emphasis and strong emphasis (example 434)", `
{P:____ is not an empty strong emphasis}
`)

  test("Emphasis and strong emphasis (example 435)", `
{P:foo ***}
`)

  test("Emphasis and strong emphasis (example 436)", `
{P:foo {Em:{e:*}{Esc:\\*}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 437)", `
{P:foo {Em:{e:*}_{e:*}}}
`)

  test("Emphasis and strong emphasis (example 438)", `
{P:foo *****}
`)

  test("Emphasis and strong emphasis (example 439)", `
{P:foo {St:{e:**}{Esc:\\*}{e:**}}}
`)

  test("Emphasis and strong emphasis (example 440)", `
{P:foo {St:{e:**}_{e:**}}}
`)

  test("Emphasis and strong emphasis (example 441)", `
{P:*{Em:{e:*}foo{e:*}}}
`)

  test("Emphasis and strong emphasis (example 442)", `
{P:{Em:{e:*}foo{e:*}}*}
`)

  test("Emphasis and strong emphasis (example 443)", `
{P:*{St:{e:**}foo{e:**}}}
`)

  test("Emphasis and strong emphasis (example 444)", `
{P:***{Em:{e:*}foo{e:*}}}
`)

  test("Emphasis and strong emphasis (example 445)", `
{P:{St:{e:**}foo{e:**}}*}
`)

  test("Emphasis and strong emphasis (example 446)", `
{P:{Em:{e:*}foo{e:*}}***}
`)

  test("Emphasis and strong emphasis (example 447)", `
{P:foo ___}
`)

  test("Emphasis and strong emphasis (example 448)", `
{P:foo {Em:{e:_}{Esc:\\_}{e:_}}}
`)

  test("Emphasis and strong emphasis (example 449)", `
{P:foo {Em:{e:_}*{e:_}}}
`)

  test("Emphasis and strong emphasis (example 450)", `
{P:foo _____}
`)

  test("Emphasis and strong emphasis (example 451)", `
{P:foo {St:{e:__}{Esc:\\_}{e:__}}}
`)

  test("Emphasis and strong emphasis (example 452)", `
{P:foo {St:{e:__}*{e:__}}}
`)

  test("Emphasis and strong emphasis (example 453)", `
{P:_{Em:{e:_}foo{e:_}}}
`)

  test("Emphasis and strong emphasis (example 454)", `
{P:{Em:{e:_}foo{e:_}}_}
`)

  test("Emphasis and strong emphasis (example 455)", `
{P:_{St:{e:__}foo{e:__}}}
`)

  test("Emphasis and strong emphasis (example 456)", `
{P:___{Em:{e:_}foo{e:_}}}
`)

  test("Emphasis and strong emphasis (example 457)", `
{P:{St:{e:__}foo{e:__}}_}
`)

  test("Emphasis and strong emphasis (example 458)", `
{P:{Em:{e:_}foo{e:_}}___}
`)

  test("Emphasis and strong emphasis (example 459)", `
{P:{St:{e:**}foo{e:**}}}
`)

  test("Emphasis and strong emphasis (example 460)", `
{P:{Em:{e:*}{Em:{e:_}foo{e:_}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 461)", `
{P:{St:{e:__}foo{e:__}}}
`)

  test("Emphasis and strong emphasis (example 462)", `
{P:{Em:{e:_}{Em:{e:*}foo{e:*}}{e:_}}}
`)

  test("Emphasis and strong emphasis (example 463)", `
{P:{St:{e:**}{St:{e:**}foo{e:**}}{e:**}}}
`)

  test("Emphasis and strong emphasis (example 464)", `
{P:{St:{e:__}{St:{e:__}foo{e:__}}{e:__}}}
`)

  test("Emphasis and strong emphasis (example 465)", `
{P:{St:{e:**}{St:{e:**}{St:{e:**}foo{e:**}}{e:**}}{e:**}}}
`)

  test("Emphasis and strong emphasis (example 466)", `
{P:{Em:{e:*}{St:{e:**}foo{e:**}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 467)", `
{P:{Em:{e:_}{St:{e:__}{St:{e:__}foo{e:__}}{e:__}}{e:_}}}
`)

  test("Emphasis and strong emphasis (example 468)", `
{P:{Em:{e:*}foo _bar{e:*}} baz_}
`)

  test("Emphasis and strong emphasis (example 469)", `
{P:{Em:{e:*}foo {St:{e:__}bar *baz bim{e:__}} bam{e:*}}}
`)

  test("Emphasis and strong emphasis (example 470)", `
{P:**foo {St:{e:**}bar baz{e:**}}}
`)

  test("Emphasis and strong emphasis (example 471)", `
{P:*foo {Em:{e:*}bar baz{e:*}}}
`)

  test("Emphasis and strong emphasis (example 472)", `
{P:*{Ln:{L:[}bar*{L:]}{L:(}{URL:/url}{L:)}}}
`)

  test("Emphasis and strong emphasis (example 473)", `
{P:_foo {Ln:{L:[}bar_{L:]}{L:(}{URL:/url}{L:)}}}
`)

  test("Emphasis and strong emphasis (example 474)", `
{P:*{HT:<img src="foo" title="*"/>}}
`)

  test("Emphasis and strong emphasis (example 475)", `
{P:**{HT:<a href="**">}}
`)

  test("Emphasis and strong emphasis (example 476)", `
{P:__{HT:<a href="__">}}
`)

  test("Emphasis and strong emphasis (example 477)", `
{P:{Em:{e:*}a {C:{c:\`}*{c:\`}}{e:*}}}
`)

  test("Emphasis and strong emphasis (example 478)", `
{P:{Em:{e:_}a {C:{c:\`}_{c:\`}}{e:_}}}
`)

  test("Emphasis and strong emphasis (example 479)", `
{P:**a{Al:{L:<}{URL:http://foo.bar/?q=**}{L:>}}}
`)

  test("Emphasis and strong emphasis (example 480)", `
{P:__a{Al:{L:<}{URL:http://foo.bar/?q=__}{L:>}}}
`)

  test("Links (example 481)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:/uri} {LT:"title"}{L:)}}}
`)

  test("Links (example 482)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:/uri}{L:)}}}
`)

  test("Links (example 483)", `
{P:{Ln:{L:[}link{L:]}{L:(}{L:)}}}
`)

  test("Links (example 484)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:<>}{L:)}}}
`)

  test("Links (example 485)", `
{P:{Ln:{L:[}link{L:]}}(/my uri)}
`)

  test("Links (example 486)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:</my uri>}{L:)}}}
`)

  test("Links (example 487)", `
{P:{Ln:{L:[}link{L:]}}(foo
bar)}
`)

  // Many of these don't align with the output in the spec because our
  // implementation doesn't check for an existing link reference when
  // accepting non-inline links.

  test("Links (example 488)", `
{P:{Ln:{L:[}link{L:]}}({HT:<foo
bar>})}
`)

  test("Links (example 489)", `
{P:{Ln:{L:[}a{L:]}{L:(}{URL:<b)c>}{L:)}}}
`)

  test("Links (example 490)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:<foo\\>}{L:)}}}
`)

  test("Links (example 491)", `
{P:{Ln:{L:[}a{L:]}}(<b)c
{Ln:{L:[}a{L:]}}(<b)c>
{Ln:{L:[}a{L:]}}({HT:<b>}c)}
`)

  test("Links (example 492)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:\\(foo\\)}{L:)}}}
`)

  test("Links (example 493)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:foo(and(bar))}{L:)}}}
`)

  test("Links (example 494)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:foo\\(and\\(bar\\)}{L:)}}}
`)

  test("Links (example 495)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:<foo(and(bar)>}{L:)}}}
`)

  test("Links (example 496)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:foo\\)\\:}{L:)}}}
`)

  test("Links (example 497)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:#fragment}{L:)}}}

{P:{Ln:{L:[}link{L:]}{L:(}{URL:http://example.com#fragment}{L:)}}}

{P:{Ln:{L:[}link{L:]}{L:(}{URL:http://example.com?foo=3#frag}{L:)}}}
`)

  test("Links (example 498)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:foo\\bar}{L:)}}}
`)

  test("Links (example 499)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:foo%20b&auml;}{L:)}}}
`)

  test("Links (example 500)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:"title"}{L:)}}}
`)

  test("Links (example 501)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:/url} {LT:"title"}{L:)}}
{Ln:{L:[}link{L:]}{L:(}{URL:/url} {LT:'title'}{L:)}}
{Ln:{L:[}link{L:]}{L:(}{URL:/url} {LT:(title)}{L:)}}}
`)

  test("Links (example 502)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:/url} {LT:"title \\"&quot;"}{L:)}}}
`)

  test("Links (example 503)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:/url "title"}{L:)}}}
`)

  test("Links (example 504)", `
{P:{Ln:{L:[}link{L:]}}(/url "title "and" title")}
`)

  test("Links (example 505)", `
{P:{Ln:{L:[}link{L:]}{L:(}{URL:/url} {LT:'title "and" title'}{L:)}}}
`)

  test("Links (example 506)", `
{P:{Ln:{L:[}link{L:]}{L:(}   {URL:/uri}
  {LT:"title"}  {L:)}}}
`)

  test("Links (example 507)", `
{P:{Ln:{L:[}link{L:]}} (/uri)}
`)

  test("Links (example 508)", `
{P:[link [foo {Ln:{L:[}bar{L:]}}]](/uri)}
`)

  test("Links (example 509)", `
{P:{Ln:{L:[}link{L:]}} bar](/uri)}
`)

  test("Links (example 510)", `
{P:[link {Ln:{L:[}bar{L:]}{L:(}{URL:/uri}{L:)}}}
`)

  test("Links (example 511)", `
{P:{Ln:{L:[}link {Esc:\\[}bar{L:]}{L:(}{URL:/uri}{L:)}}}
`)

  test("Links (example 512)", `
{P:{Ln:{L:[}link {Em:{e:*}foo {St:{e:**}bar{e:**}} {C:{c:\`}#{c:\`}}{e:*}}{L:]}{L:(}{URL:/uri}{L:)}}}
`)

  test("Links (example 513)", `
{P:{Ln:{L:[}{Im:{L:![}moon{L:]}{L:(}{URL:moon.jpg}{L:)}}{L:]}{L:(}{URL:/uri}{L:)}}}
`)

  test("Links (example 514)", `
{P:[foo {Ln:{L:[}bar{L:]}{L:(}{URL:/uri}{L:)}}](/uri)}
`)

  test("Links (example 515)", `
{P:[foo {Em:{e:*}[bar {Ln:{L:[}baz{L:]}{L:(}{URL:/uri}{L:)}}](/uri){e:*}}](/uri)}
`)

  test("Links (example 516)", `
{P:{Im:{L:![}[{Ln:{L:[}foo{L:]}{L:(}{URL:uri1}{L:)}}](uri2){L:]}{L:(}{URL:uri3}{L:)}}}
`)

  test("Links (example 517)", `
{P:*{Ln:{L:[}foo*{L:]}{L:(}{URL:/uri}{L:)}}}
`)

  test("Links (example 518)", `
{P:{Ln:{L:[}foo *bar{L:]}{L:(}{URL:baz*}{L:)}}}
`)

  // Not the spirit of the test, because the shortcut link is still
  // accepted.
  test("Links (example 519)", `
{P:*foo {Ln:{L:[}bar* baz{L:]}}}
`)

  test("Links (example 520)", `
{P:[foo {HT:<bar attr="](baz)">}}
`)

  test("Links (example 521)", `
{P:[foo{C:{c:\`}](/uri){c:\`}}}
`)

  test("Links (example 522)", `
{P:[foo{Al:{L:<}{URL:http://example.com/?search=](uri)}{L:>}}}
`)

  test("Links (example 523)", `
{P:{Ln:{L:[}foo{L:]}{LL:[bar]}}}

{LR:{LL:[bar]}{L::} {URL:/url} {LT:"title"}}
`)

  // This has a different shape than the original test case, because
  // we accept the innermost link.
  test("Links (example 524)", `
{P:[link [foo {Ln:{L:[}bar{L:]}}]]{Ln:{L:[}ref{L:]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 525)", `
{P:{Ln:{L:[}link {Esc:\\[}bar{L:]}{LL:[ref]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 526)", `
{P:{Ln:{L:[}link {Em:{e:*}foo {St:{e:**}bar{e:**}} {C:{c:\`}#{c:\`}}{e:*}}{L:]}{LL:[ref]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 527)", `
{P:{Ln:{L:[}{Im:{L:![}moon{L:]}{L:(}{URL:moon.jpg}{L:)}}{L:]}{LL:[ref]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 528)", `
{P:[foo {Ln:{L:[}bar{L:]}{L:(}{URL:/uri}{L:)}}]{Ln:{L:[}ref{L:]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 529)", `
{P:[foo {Em:{e:*}bar {Ln:{L:[}baz{L:]}{LL:[ref]}}{e:*}}]{Ln:{L:[}ref{L:]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 530)", `
{P:*{Ln:{L:[}foo*{L:]}{LL:[ref]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 531)", `
{P:{Ln:{L:[}foo *bar{L:]}{LL:[ref]}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 532)", `
{P:[foo {HT:<bar attr="][ref]">}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 533)", `
{P:[foo{C:{c:\`}][ref]{c:\`}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 534)", `
{P:[foo{Al:{L:<}{URL:http://example.com/?search=][ref]}{L:>}}}

{LR:{LL:[ref]}{L::} {URL:/uri}}
`)

  test("Links (example 535)", `
{P:{Ln:{L:[}foo{L:]}{LL:[BaR]}}}

{LR:{LL:[bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 536)", `
{P:{Ln:{L:[}Толпой{L:]}{LL:[Толпой]}} is a Russian word.}

{LR:{LL:[ТОЛПОЙ]}{L::} {URL:/url}}
`)

  test("Links (example 537)", `
{LR:{LL:[Foo
  bar]}{L::} {URL:/url}}

{P:{Ln:{L:[}Baz{L:]}{LL:[Foo bar]}}}
`)

  test("Links (example 538)", `
{P:{Ln:{L:[}foo{L:]}} {Ln:{L:[}bar{L:]}}}

{LR:{LL:[bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 539)", `
{P:{Ln:{L:[}foo{L:]}}
{Ln:{L:[}bar{L:]}}}

{LR:{LL:[bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 540)", `
{LR:{LL:[foo]}{L::} {URL:/url1}}

{LR:{LL:[foo]}{L::} {URL:/url2}}

{P:{Ln:{L:[}bar{L:]}{LL:[foo]}}}
`)

  test("Links (example 541)", `
{P:{Ln:{L:[}bar{L:]}{LL:[foo\\!]}}}

{LR:{LL:[foo!]}{L::} {URL:/url}}
`)

  test("Links (example 542)", `
{P:{Ln:{L:[}foo{L:]}}[ref[]}

{P:[ref[]: /uri}
`)

  test("Links (example 543)", `
{P:{Ln:{L:[}foo{L:]}}[ref{Ln:{L:[}bar{L:]}}]}

{P:[ref{Ln:{L:[}bar{L:]}}]: /uri}
`)

  test("Links (example 544)", `
{P:[[{Ln:{L:[}foo{L:]}}]]}

{P:[[{Ln:{L:[}foo{L:]}}]]: /url}
`)

  test("Links (example 545)", `
{P:{Ln:{L:[}foo{L:]}{LL:[ref\\[]}}}

{LR:{LL:[ref\\[]}{L::} {URL:/uri}}
`)

  test("Links (example 546)", `
{LR:{LL:[bar\\\\]}{L::} {URL:/uri}}

{P:{Ln:{L:[}bar{Esc:\\\\}{L:]}}}
`)

  test("Links (example 547)", `
{P:[]}

{P:[]: /uri}
`)

  test("Links (example 548)", `
{P:[
 ]}

{P:[
 ]: /uri}
`)

  test("Links (example 549)", `
{P:{Ln:{L:[}foo{L:]}{LL:[]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 550)", `
{P:{Ln:{L:[}{Em:{e:*}foo{e:*}} bar{L:]}{LL:[]}}}

{LR:{LL:[*foo* bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 551)", `
{P:{Ln:{L:[}Foo{L:]}{LL:[]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 552)", `
{P:{Ln:{L:[}foo{L:]}} 
[]}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 553)", `
{P:{Ln:{L:[}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 554)", `
{P:{Ln:{L:[}{Em:{e:*}foo{e:*}} bar{L:]}}}

{LR:{LL:[*foo* bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 555)", `
{P:[{Ln:{L:[}{Em:{e:*}foo{e:*}} bar{L:]}}]}

{LR:{LL:[*foo* bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 556)", `
{P:[[bar {Ln:{L:[}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/url}}
`)

  test("Links (example 557)", `
{P:{Ln:{L:[}Foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 558)", `
{P:{Ln:{L:[}foo{L:]}} bar}

{LR:{LL:[foo]}{L::} {URL:/url}}
`)

  test("Links (example 559)", `
{P:{Esc:\\[}foo]}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Links (example 560)", `
{LR:{LL:[foo*]}{L::} {URL:/url}}

{P:*{Ln:{L:[}foo*{L:]}}}
`)

  test("Links (example 561)", `
{P:{Ln:{L:[}foo{L:]}{LL:[bar]}}}

{LR:{LL:[foo]}{L::} {URL:/url1}}
{LR:{LL:[bar]}{L::} {URL:/url2}}
`)

  test("Links (example 562)", `
{P:{Ln:{L:[}foo{L:]}{LL:[]}}}

{LR:{LL:[foo]}{L::} {URL:/url1}}
`)

  test("Links (example 563)", `
{P:{Ln:{L:[}foo{L:]}{L:(}{L:)}}}

{LR:{LL:[foo]}{L::} {URL:/url1}}
`)

  test("Links (example 564)", `
{P:{Ln:{L:[}foo{L:]}}(not a link)}

{LR:{LL:[foo]}{L::} {URL:/url1}}
`)

  // Not really testing what it is supposed to, because the first two
  // bracket pairs are blindly accepted as link.
  test("Links (example 565)", `
{P:{Ln:{L:[}foo{L:]}{LL:[bar]}}{Ln:{L:[}baz{L:]}}}

{LR:{LL:[baz]}{L::} {URL:/url}}
`)

  test("Links (example 566)", `
{P:{Ln:{L:[}foo{L:]}{LL:[bar]}}{Ln:{L:[}baz{L:]}}}

{LR:{LL:[baz]}{L::} {URL:/url1}}
{LR:{LL:[bar]}{L::} {URL:/url2}}
`)

  test("Links (example 567)", `
{P:{Ln:{L:[}foo{L:]}{LL:[bar]}}{Ln:{L:[}baz{L:]}}}

{LR:{LL:[baz]}{L::} {URL:/url1}}
{LR:{LL:[foo]}{L::} {URL:/url2}}
`)

  test("Images (example 568)", `
{P:{Im:{L:![}foo{L:]}{L:(}{URL:/url} {LT:"title"}{L:)}}}
`)

  test("Images (example 569)", `
{P:{Im:{L:![}foo {Em:{e:*}bar{e:*}}{L:]}}}

{LR:{LL:[foo *bar*]}{L::} {URL:train.jpg} {LT:"train & tracks"}}
`)

  test("Images (example 570)", `
{P:{Im:{L:![}foo {Im:{L:![}bar{L:]}{L:(}{URL:/url}{L:)}}{L:]}{L:(}{URL:/url2}{L:)}}}
`)

  test("Images (example 571)", `
{P:{Im:{L:![}foo {Ln:{L:[}bar{L:]}{L:(}{URL:/url}{L:)}}{L:]}{L:(}{URL:/url2}{L:)}}}
`)

  test("Images (example 572)", `
{P:{Im:{L:![}foo {Em:{e:*}bar{e:*}}{L:]}{LL:[]}}}

{LR:{LL:[foo *bar*]}{L::} {URL:train.jpg} {LT:"train & tracks"}}
`)

  test("Images (example 573)", `
{P:{Im:{L:![}foo {Em:{e:*}bar{e:*}}{L:]}{LL:[foobar]}}}

{LR:{LL:[FOOBAR]}{L::} {URL:train.jpg} {LT:"train & tracks"}}
`)

  test("Images (example 574)", `
{P:{Im:{L:![}foo{L:]}{L:(}{URL:train.jpg}{L:)}}}
`)

  test("Images (example 575)", `
{P:My {Im:{L:![}foo bar{L:]}{L:(}{URL:/path/to/train.jpg}  {LT:"title"}   {L:)}}}
`)

  test("Images (example 576)", `
{P:{Im:{L:![}foo{L:]}{L:(}{URL:<url>}{L:)}}}
`)

  test("Images (example 577)", `
{P:{Im:{L:![}{L:]}{L:(}{URL:/url}{L:)}}}
`)

  test("Images (example 578)", `
{P:{Im:{L:![}foo{L:]}{LL:[bar]}}}

{LR:{LL:[bar]}{L::} {URL:/url}}
`)

  test("Images (example 579)", `
{P:{Im:{L:![}foo{L:]}{LL:[bar]}}}

{LR:{LL:[BAR]}{L::} {URL:/url}}
`)

  test("Images (example 580)", `
{P:{Im:{L:![}foo{L:]}{LL:[]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 581)", `
{P:{Im:{L:![}{Em:{e:*}foo{e:*}} bar{L:]}{LL:[]}}}

{LR:{LL:[*foo* bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 582)", `
{P:{Im:{L:![}Foo{L:]}{LL:[]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 583)", `
{P:{Im:{L:![}foo{L:]}} 
[]}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 584)", `
{P:{Im:{L:![}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 585)", `
{P:{Im:{L:![}{Em:{e:*}foo{e:*}} bar{L:]}}}

{LR:{LL:[*foo* bar]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 586)", `
{P:{Im:{L:![}{Ln:{L:[}foo{L:]}}{L:]}}}

{P:[{Ln:{L:[}foo{L:]}}]: /url "title"}
`)

  test("Images (example 587)", `
{P:{Im:{L:![}Foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 588)", `
{P:!{Esc:\\[}foo]}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Images (example 589)", `
{P:{Esc:\\!}{Ln:{L:[}foo{L:]}}}

{LR:{LL:[foo]}{L::} {URL:/url} {LT:"title"}}
`)

  test("Autolinks (example 590)", `
{P:{Al:{L:<}{URL:http://foo.bar.baz}{L:>}}}
`)

  test("Autolinks (example 591)", `
{P:{Al:{L:<}{URL:http://foo.bar.baz/test?q=hello&id=22&boolean}{L:>}}}
`)

  test("Autolinks (example 592)", `
{P:{Al:{L:<}{URL:irc://foo.bar:2233/baz}{L:>}}}
`)

  test("Autolinks (example 593)", `
{P:{Al:{L:<}{URL:MAILTO:FOO@BAR.BAZ}{L:>}}}
`)

  test("Autolinks (example 594)", `
{P:{Al:{L:<}{URL:a+b+c:d}{L:>}}}
`)

  test("Autolinks (example 595)", `
{P:{Al:{L:<}{URL:made-up-scheme://foo,bar}{L:>}}}
`)

  test("Autolinks (example 596)", `
{P:{Al:{L:<}{URL:http://../}{L:>}}}
`)

  test("Autolinks (example 597)", `
{P:{Al:{L:<}{URL:localhost:5001/foo}{L:>}}}
`)

  test("Autolinks (example 598)", `
{P:<http://foo.bar/baz bim>}
`)

  test("Autolinks (example 599)", `
{P:{Al:{L:<}{URL:http://example.com/\\[\\}{L:>}}}
`)

  test("Autolinks (example 600)", `
{P:{Al:{L:<}{URL:foo@bar.example.com}{L:>}}}
`)

  test("Autolinks (example 601)", `
{P:{Al:{L:<}{URL:foo+special@Bar.baz-bar0.com}{L:>}}}
`)

  test("Autolinks (example 602)", `
{P:<foo{Esc:\\+}@bar.example.com>}
`)

  test("Autolinks (example 603)", `
{P:<>}
`)

  test("Autolinks (example 604)", `
{P:< http://foo.bar >}
`)

  test("Autolinks (example 605)", `
{P:<m:abc>}
`)

  test("Autolinks (example 606)", `
{P:<foo.bar.baz>}
`)

  test("Autolinks (example 607)", `
{P:http://example.com}
`)

  test("Autolinks (example 608)", `
{P:foo@bar.example.com}
`)

  test("Raw HTML (example 609)", `
{P:{HT:<a>}{HT:<bab>}{HT:<c2c>}}
`)

  test("Raw HTML (example 610)", `
{P:{HT:<a/>}{HT:<b2/>}}
`)

  test("Raw HTML (example 611)", `
{P:{HT:<a  />}{HT:<b2
data="foo" >}}
`)

  test("Raw HTML (example 612)", `
{P:{HT:<a foo="bar" bam = 'baz <em>"</em>'
_boolean zoop:33=zoop:33 />}}
`)

  test("Raw HTML (example 613)", `
{P:Foo {HT:<responsive-image src="foo.jpg" />}}
`)

  test("Raw HTML (example 614)", `
{P:<33> <__>}
`)

  test("Raw HTML (example 615)", `
{P:<a h*#ref="hi">}
`)

  test("Raw HTML (example 616)", `
{P:<a href="hi'> <a href=hi'>}
`)

  test("Raw HTML (example 617)", `
{P:{HT:< a>}{HT:<
foo>}{HT:<bar/ >}
<foo bar=baz
bim!bop />}
`)

  test("Raw HTML (example 618)", `
{P:<a href='bar'title=title>}
`)

  test("Raw HTML (example 619)", `
{P:{HT:</a>}{HT:</foo >}}
`)

  test("Raw HTML (example 620)", `
{P:</a href="foo">}
`)

  test("Raw HTML (example 621)", `
{P:foo {CM:<!-- this is a
comment - with hyphen -->}}
`)

  test("Raw HTML (example 622)", `
{P:foo <!-- not a comment -- two hyphens -->}
`)

  test("Raw HTML (example 623)", `
{P:foo <!--> foo -->}

{P:foo <!-- foo--->}
`)

  test("Raw HTML (example 624)", `
{P:foo {Pi:<?php echo $a; ?>}}
`)

  test("Raw HTML (example 625)", `
{P:foo {HT:<!ELEMENT br EMPTY>}}
`)

  test("Raw HTML (example 626)", `
{P:foo {HT:<![CDATA[>&<]]>}}
`)

  test("Raw HTML (example 627)", `
{P:foo {HT:<a href="&ouml;">}}
`)

  test("Raw HTML (example 628)", `
{P:foo {HT:<a href="\\*">}}
`)

  test("Raw HTML (example 629)", `
{P:<a href="{Esc:\\"}">}
`)

  test("Hard line breaks (example 630)", `
{P:foo{BR:  
}baz}
`)

  test("Hard line breaks (example 631)", `
{P:foo{BR:\\
}baz}
`)

  test("Hard line breaks (example 632)", `
{P:foo{BR:       
}baz}
`)

  test("Hard line breaks (example 633)", `
{P:foo{BR:  
}     bar}
`)

  test("Hard line breaks (example 634)", `
{P:foo{BR:\\
}     bar}
`)

  test("Hard line breaks (example 635)", `
{P:{Em:{e:*}foo{BR:  
}bar{e:*}}}
`)

  test("Hard line breaks (example 636)", `
{P:{Em:{e:*}foo{BR:\\
}bar{e:*}}}
`)

  test("Hard line breaks (example 637)", `
{P:{C:{c:\`}code 
span{c:\`}}}
`)

  test("Hard line breaks (example 638)", `
{P:{C:{c:\`}code\\
span{c:\`}}}
`)

  test("Hard line breaks (example 639)", `
{P:{HT:<a href="foo  
bar">}}
`)

  test("Hard line breaks (example 640)", `
{P:{HT:<a href="foo\\
bar">}}
`)

  test("Hard line breaks (example 641)", `
{P:foo\\}
`)

  test("Hard line breaks (example 642)", `
{P:foo  }
`)

  test("Hard line breaks (example 643)", `
{H3:{h:###} foo\\}
`)

  test("Hard line breaks (example 644)", `
{H3:{h:###} foo  }
`)

  test("Soft line breaks (example 645)", `
{P:foo
baz}
`)

  test("Soft line breaks (example 646)", `
{P:foo 
 baz}
`)

  test("Textual content (example 647)", `
{P:hello $.;'there}
`)

  test("Textual content (example 648)", `
{P:Foo χρῆν}
`)

  test("Textual content (example 649)", `
{P:Multiple     spaces}
`)
})

describe("Custom Markdown tests", () => {
  // (Not ideal that the 3rd mark is inside the previous item, but
  // this'd require quite a big overhaul to fix.)
  test("Quote markers don't end up inside inner list items", `
{Q:{q:>} {BL:{LI:{l:-} {P:Hello}}
{q:>} {LI:{l:-} {P:Two}
{q:>}}
{q:>} {LI:{l:-} {P:Three}}}}
`)

  test("Nested bullet lists don't break ordered list parsing", `
{OL:{LI:{l:1.} {P:A}
   {BL:{LI:{l:*} {P:A1}}
   {LI:{l:*} {P:A2}}}}
{LI:{l:2.} {P:B}}}
`)

  it("Doesn't get confused by tabs indenting a list item", () => {
    let doc = ` - a\n\t\tb`
    if (parser.parse(doc).length > doc.length) throw new RangeError("Wrong tree length")
  })

  it("Parses horizontal rules when setext headers are disabled", () => {
    let tree = parser.configure({remove: ["SetextHeading"]}).parse(`abc\n---`)
    if (tree.toString() != "Document(Paragraph,HorizontalRule)")
      throw new Error("Unexpected tree: " + tree)
  })
})
