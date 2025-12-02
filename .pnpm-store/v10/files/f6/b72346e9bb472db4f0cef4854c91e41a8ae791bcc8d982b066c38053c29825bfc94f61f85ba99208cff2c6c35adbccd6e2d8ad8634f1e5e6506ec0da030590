import {parser as cmParser, GFM, Subscript, Superscript, Emoji} from "../dist/index.js"
import {compareTree} from "./compare-tree.js"
import {SpecParser} from "./spec.js"

const parser = cmParser.configure([GFM, Subscript, Superscript, Emoji])

const specParser = new SpecParser(parser, {
  __proto__: null as any,
  Th: "Strikethrough",
  tm: "StrikethroughMark",
  TB: "Table",
  TH: "TableHeader",
  TR: "TableRow",
  TC: "TableCell",
  tb: "TableDelimiter",
  T: "Task",
  t: "TaskMarker",
  Sub: "Subscript",
  sub: "SubscriptMark",
  Sup: "Superscript",
  sup: "SuperscriptMark",
  ji: "Emoji"
})

function test(name: string, spec: string, p = parser) {
  it(name, () => {
    let {tree, doc} = specParser.parse(spec, name)
    compareTree(p.parse(doc), tree)
  })
}

describe("Extension", () => {
  test("Tables (example 198)", `
{TB:{TH:{tb:|} {TC:foo} {tb:|} {TC:bar} {tb:|}}
{tb:| --- | --- |}
{TR:{tb:|} {TC:baz} {tb:|} {TC:bim} {tb:|}}}`)

  test("Tables (example 199)", `
{TB:{TH:{tb:|} {TC:abc} {tb:|} {TC:defghi} {tb:|}}
{tb::-: | -----------:}
{TR:{TC:bar} {tb:|} {TC:baz}}}`)

  test("Tables (example 200)", `
{TB:{TH:{tb:|} {TC:f{Esc:\\|}oo}  {tb:|}}
{tb:| ------ |}
{TR:{tb:|} {TC:b {C:{c:\`}\\|{c:\`}} az} {tb:|}}
{TR:{tb:|} {TC:b {St:{e:**}{Esc:\\|}{e:**}} im} {tb:|}}}`)

  test("Tables (example 201)", `
{TB:{TH:{tb:|} {TC:abc} {tb:|} {TC:def} {tb:|}}
{tb:| --- | --- |}
{TR:{tb:|} {TC:bar} {tb:|} {TC:baz} {tb:|}}}
{Q:{q:>} {P:bar}}`)

  test("Tables (example 202)", `
{TB:{TH:{tb:|} {TC:abc} {tb:|} {TC:def} {tb:|}}
{tb:| --- | --- |}
{TR:{tb:|} {TC:bar} {tb:|} {TC:baz} {tb:|}}
{TR:{TC:bar}}}

{P:bar}`)

  test("Tables (example 203)", `
{P:| abc | def |
| --- |
| bar |}`)

  test("Tables (example 204)", `
{TB:{TH:{tb:|} {TC:abc} {tb:|} {TC:def} {tb:|}}
{tb:| --- | --- |}
{TR:{tb:|} {TC:bar} {tb:|}}
{TR:{tb:|} {TC:bar} {tb:|} {TC:baz} {tb:|} {TC:boo} {tb:|}}}`)

  test("Tables (example 205)", `
{TB:{TH:{tb:|} {TC:abc} {tb:|} {TC:def} {tb:|}}
{tb:| --- | --- |}}`)

  test("Tables (in blockquote)", `
{Q:{q:>} {TB:{TH:{tb:|} {TC:one} {tb:|} {TC:two} {tb:|}}
{q:>} {tb:| --- | --- |}
{q:>} {TR:{tb:|} {TC:123} {tb:|} {TC:456} {tb:|}}}
{q:>}
{q:>} {P:Okay}}`)

  test("Tables (empty header)", `
{TB:{TH:{tb:|} {tb:|} {tb:|}}
{tb:| :-: | :-: |}
{TR:{tb:|} {TC:One} {tb:|} {TC:Two} {tb:|}}}`)

  test("Tables (end paragraph)", `
{P:Hello}
{TB:{TH:{tb:|} {TC:foo} {tb:|} {TC:bar} {tb:|}}
{tb:| --- | --- |}
{TR:{tb:|} {TC:baz} {tb:|} {TC:bim} {tb:|}}}`)

  test("Tables (invalid tables don't end paragraph)", `
{P:Hello
| abc | def |
| --- |
| bar |}`)

  test("Task list (example 279)", `
{BL:{LI:{l:-} {T:{t:[ ]} foo}}
{LI:{l:-} {T:{t:[x]} bar}}}`)

  test("Task list (example 280)", `
{BL:{LI:{l:-} {T:{t:[x]} foo}
  {BL:{LI:{l:-} {T:{t:[ ]} bar}}
  {LI:{l:-} {T:{t:[x]} baz}}}}
{LI:{l:-} {T:{t:[ ]} bim}}}`)

  test("Autolink (example 622)", `
{P:{URL:www.commonmark.org}}`)

  test("Autolink (example 623)", `
{P:Visit {URL:www.commonmark.org/help} for more information.}`)

  test("Autolink (example 624)", `
{P:Visit {URL:www.commonmark.org}.}

{P:Visit {URL:www.commonmark.org/a.b}.}`)

  test("Autolink (example 625)", `
{P:{URL:www.google.com/search?q=Markup+(business)}}

{P:{URL:www.google.com/search?q=Markup+(business)}))}

{P:({URL:www.google.com/search?q=Markup+(business)})}

{P:({URL:www.google.com/search?q=Markup+(business)}}`)

  test("Autolink (example 626)", `
{P:{URL:www.google.com/search?q=(business))+ok}}`)

  test("Autolink (example 627)", `
{P:{URL:www.google.com/search?q=commonmark&hl=en}}

{P:{URL:www.google.com/search?q=commonmark}{Entity:&hl;}}`)

  test("Autolink (example 628)", `
{P:{URL:www.commonmark.org/he}<lp}`)

  test("Autolink (example 629)", `
{P:{URL:http://commonmark.org}}

{P:(Visit {URL:https://encrypted.google.com/search?q=Markup+(business)})}`)

  test("Autolink (example 630)", `
{P:{URL:foo@bar.baz}}`)

  test("Autolink (example 631)", `
{P:hello@mail+xyz.example isn't valid, but {URL:hello+xyz@mail.example} is.}`)

  test("Autolink (example 632)", `
{P:{URL:a.b-c_d@a.b}}

{P:{URL:a.b-c_d@a.b}.}

{P:a.b-c_d@a.b-}

{P:a.b-c_d@a.b_}`)

  test("Autolink (example 633)", `
{P:{URL:mailto:foo@bar.baz}}

{P:{URL:mailto:a.b-c_d@a.b}}

{P:{URL:mailto:a.b-c_d@a.b}.}

{P:{URL:mailto:a.b-c_d@a.b}/}

{P:mailto:a.b-c_d@a.b-}

{P:mailto:a.b-c_d@a.b_}

{P:{URL:xmpp:foo@bar.baz}}

{P:{URL:xmpp:foo@bar.baz}.}`)

  test("Autolink (example 634)", `
{P:{URL:xmpp:foo@bar.baz/txt}}

{P:{URL:xmpp:foo@bar.baz/txt@bin}}

{P:{URL:xmpp:foo@bar.baz/txt@bin.com}}`)

  test("Autolink (example 635)", `
{P:{URL:xmpp:foo@bar.baz/txt}/bin}`)

  test("Task list (in ordered list)", `
{OL:{LI:{l:1.} {T:{t:[X]} Okay}}}`)

  test("Task list (versus table)", `
{BL:{LI:{l:-} {TB:{TH:{TC:[ ] foo} {tb:|} {TC:bar}}
  {tb:--- | ---}}}}`)

  test("Task list (versus setext header)", `
{OL:{LI:{l:1.} {SH1:{Ln:{L:[}X{L:]}} foo
   {h:===}}}}`)

  test("Strikethrough (example 491)", `
{P:{Th:{tm:~~}Hi{tm:~~}} Hello, world!}`)

  test("Strikethrough (example 492)", `
{P:This ~~has a}

{P:new paragraph~~.}`)

  test("Strikethrough (nested)", `
{P:Nesting {St:{e:**}with {Th:{tm:~~}emphasis{tm:~~}}{e:**}}.}`)

  test("Strikethrough (overlapping)", `
{P:One {St:{e:**}two ~~three{e:**}} four~~}

{P:One {Th:{tm:~~}two **three{tm:~~}} four**}`)

  test("Strikethrough (escaped)", `
{P:A {Esc:\\~}~b c~~}`)

  test("Strikethrough around spaces", `
{P:One ~~ two~~ three {Th:{tm:~~}.foo.{tm:~~}} a~~.foo.~~a {Th:{tm:~~}blah{tm:~~}}.}`)

  test("Subscript", `
{P:One {Sub:{sub:~}two{sub:~}} {Em:{e:*}one {Sub:{sub:~}two{sub:~}}{e:*}}}`)

  test("Subscript (no spaces)", `
{P:One ~two three~}`)

  test("Subscript (escapes)", `
{P:One {Sub:{sub:~}two{Esc:\\ }th{Esc:\\~}ree{sub:~}}}`)

  test("Superscript", `
{P:One {Sup:{sup:^}two{sup:^}} {Em:{e:*}one {Sup:{sup:^}two{sup:^}}{e:*}}}`)

  test("Superscript (no spaces)", `
{P:One ^two three^}`)

  test("Superscript (escapes)", `
{P:One {Sup:{sup:^}two{Esc:\\ }th{Esc:\\^}ree{sup:^}}}`)

  test("Emoji", `
{P:Hello {ji::smile:} {ji::100:}}`)

  test("Emoji (format)", `
{P:Hello :smi le: :1.00: ::}`)

  test("Disable syntax", `
{BL:{LI:{l:-} {P:List still {Em:{e:*}works{e:*}}}}}

{P:> No quote, no ^sup^}

{P:No setext either
===}`, parser.configure({remove: ["Superscript", "Blockquote", "SetextHeading"]}))

  test("Autolink (.co.uk)", `
{P:{URL:www.blah.co.uk/path}}`)

  test("Autolink (email .co.uk)", `
{P:{URL:foo@bar.co.uk}}`)

  test("Autolink (http://www.foo-bar.com/)", `
{P:{URL:http://www.foo-bar.com/}}`)

  test("Autolink (exclude underscores)", `
{P:http://www.foo_/ http://foo_.com}`)

  test("Autolink (in image)", `
{P:{Im:{L:![}Link: {URL:http://foo.com/}{L:]}{L:(}{URL:x.jpg}{L:)}}}`)
})
