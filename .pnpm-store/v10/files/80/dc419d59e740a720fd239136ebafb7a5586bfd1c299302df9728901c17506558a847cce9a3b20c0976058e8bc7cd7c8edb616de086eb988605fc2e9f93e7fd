// Build github-proof readmes that contain the package's API
// docs as HTML.

const {gather} = require("getdocs-ts")
const {build} = require("builddocs")
const {join} = require("path"), fs = require("fs")

let root = join(__dirname, "..")

function buildReadme() {
  let template = fs.readFileSync(join(root, "src", "README.md"), "utf8")

  let placeholders = template.match(/\n@\w+(?=\n|$)/g), dummy = placeholders.join("\n\n<hr>\n\n")
  let html = build({
    mainText: dummy,
    anchorPrefix: "",
    allowUnresolvedTypes: false,
    imports: [type => {
      if (/\bcommon\b/.test(type.typeSource))
        return `https://lezer.codemirror.net/docs/ref/#common.${type.type}`
      if (/\blr\b/.test(type.typeSource))
        return `https://lezer.codemirror.net/docs/ref/#lr.${type.type}`
      if (/\bhighlight\b/.test(type.typeSource))
        return `https://lezer.codemirror.net/docs/ref/#highlight.${type.type}`
      if (type.type == "NodeSet") console.log(type.typeSource)
    }]
  }, gather({filename: join(root, "src", "index.ts"), basedir: join(root, "src"), }))

  html = html.replace(/<\/?span.*?>/g, "")
    .replace(/id="(.*?)"/g, (_, id) => `id="user-content-${id.toLowerCase()}"`)
    .replace(/href="#(.*?)"/g, (_, id) => `href="#user-content-${id.toLowerCase()}"`)

  let pieces = html.split("\n<hr>\n")

  let i = 0
  return template.replace(/\n@\w+(?=\n|$)/g, _ => pieces[i++])
}

fs.writeFileSync(join(root, "README.md"), buildReadme())
