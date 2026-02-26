import * as prettier from 'prettier'
import { remark } from 'remark'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import { visit } from 'unist-util-visit'

const DISABLE_PRETTIER_RE = /(^|[{,\s])prettier\s*:\s*false([},\s]|$)/

const processor = remark()
  .data('settings', {
    bullet: '-',
    bulletOther: '*',
    rule: '-',
    emphasis: '_',
    quote: "'",
    incrementListMarker: false,
  })
  .use(remarkFrontmatter)
  .use(remarkGfm, { tablePipeAlign: false })
  .use(remarkMdx, { printWidth: 120 })

/**
 * remark will escape the opening bracket in Docusaurus admonitions: `:::warning\[Title]`
 * We visit each admonition and replace the opening bracket with a temporary marker (`__ADMONITION_MARKER__`)
 * _After_ remark does its thing we replace the marker with an opening bracket
 */
function remarkAddAdmonitionMarkers() {
  return function traverse(tree) {
    visit(tree, 'text', node => {
      node.value = node.value.replace(
        /^(:::(?:note|tip|info|warning|danger|important|caution))\[/gm,
        '$1__ADMONITION_MARKER__',
      )
    })
  }
}
function replaceAdmonitionMarkers(text) {
  return text.replaceAll('\\_\\_ADMONITION\\_MARKER\\_\\_', '[')
}

function remarkFormatCodeBlocks(prettierOptions) {
  return async function traverse(tree) {
    let promises = []

    visit(tree, 'code', node => {
      let prettierDisabled = !prettierOptions.mdxFormatCodeBlocks || DISABLE_PRETTIER_RE.test(node.meta ?? '')
      let prettierEnabled = !prettierDisabled

      if (prettierEnabled) {
        let parser = inferParser(prettierOptions, { language: node.lang })

        if (parser) {
          promises.push(
            prettier
              .format(node.value, {
                ...prettierOptions,
                parser,
                printWidth: 100,
              })
              .then(formatted => {
                let newValue = formatted.trimEnd()

                /**
                 * If the formatter added a semi-colon to the start then remove it.
                 * Prevents `<Example />` from becoming `;<Example />`
                 */
                if (newValue.startsWith(';') && !node.value.startsWith(';')) {
                  newValue = newValue.slice(1)
                }
                node.value = newValue
              })
              .catch(error => {
                if (error instanceof SyntaxError) {
                  error.message = error.message.replace(
                    /\((\d+):(\d+)\)/,
                    (_, line, column) =>
                      `(${parseInt(line, 10) + node.position.start.line}:${parseInt(column, 10) + node.position.start.column - 1})`,
                  )
                }
                throw error
              }),
          )
        }
      }
    })

    await Promise.all(promises)
  }
}

// https://github.com/prettier/prettier/blob/8a88cdce6d4605f206305ebb9204a0cabf96a070/src/utils/infer-parser.js#L61
function inferParser(prettierOptions, fileInfo) {
  let languages = prettierOptions.plugins.flatMap(plugin => plugin.languages ?? [])
  let language = getLanguageByLanguageName(languages, fileInfo.language)
  return language?.parsers[0]
}

// https://github.com/prettier/prettier/blob/8a88cdce6d4605f206305ebb9204a0cabf96a070/src/utils/infer-parser.js#L24
function getLanguageByLanguageName(languages, languageName) {
  if (!languageName) {
    return
  }

  return (
    languages.find(({ name }) => name.toLowerCase() === languageName) ??
    languages.find(({ aliases }) => aliases?.includes(languageName)) ??
    languages.find(({ extensions }) => extensions?.includes(`.${languageName}`))
  )
}

export const parsers = {
  'mdx-custom': {
    astFormat: 'mdx-custom',
    parse(text) {
      return { text }
    },
  },
}

export const printers = {
  'mdx-custom': {
    async print(ast, prettierOptions) {
      let text = ast.stack[0].text

      text = String(
        await processor().use(remarkFormatCodeBlocks, prettierOptions).use(remarkAddAdmonitionMarkers).process(text),
      )
      text = replaceAdmonitionMarkers(text)

      return text
    },
  },
}

export const options = {
  mdxFormatCodeBlocks: {
    type: 'boolean',
    category: 'Global',
    default: true,
    description: 'Format the code within fenced code blocks.',
  },
}
