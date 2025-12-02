template
  = parts:(literal / expression)*
  { return {type: 'template', parts} }

expression
  = '{' operator:operator variables:variables '}'
  { return {type: 'expression', operator, variables} }

operator
  = [/;.?&+#] / ''

variables
  = hd:variable rst:(',' v:variable { return v })*
  { rst.unshift(hd); return rst; }

variable
  = name:$([a-zA-Z0-9_.%]+) modifier:(substr / listMarker)? extension:extension?
  { return { type: 'variable', name, modifier, extension } }

listMarker
  = '*'
  { return { type: 'explode' } }

substr
  = ':' digits:$[0-9]+
  { return { type: 'substr', length: parseInt(digits) } }

literal
    = value:$[^{]+
    { return { type: 'literal', value } }

extension
  = '(' text:$[^)]+ ')' { return text }
