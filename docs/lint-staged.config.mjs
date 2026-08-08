const isGeneratedModelDoc = file => file.includes('/src/content/en/models/')

export default {
  '*.{ts,tsx,js,jsx,json,md,yml,yaml,css}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.mdx': files => {
    const editable = files.filter(file => !isGeneratedModelDoc(file))
    return editable.length ? [`oxfmt-mdx --write ${editable.join(' ')}`] : []
  },
}
