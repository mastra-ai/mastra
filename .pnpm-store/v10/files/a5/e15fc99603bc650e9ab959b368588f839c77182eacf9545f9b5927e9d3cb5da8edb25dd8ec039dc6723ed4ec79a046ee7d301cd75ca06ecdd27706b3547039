import * as _codemirror_state from '@codemirror/state';
import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { Completion, CompletionSource } from '@codemirror/autocomplete';

/**
Describes an element in your XML document schema.
*/
interface ElementSpec {
    /**
    The element name.
    */
    name: string;
    /**
    Allowed children in this element. When not given, all elements
    are allowed inside it.
    */
    children?: readonly string[];
    /**
    When given, allows users to complete the given content strings
    as plain text when at the start of the element.
    */
    textContent?: readonly string[];
    /**
    Whether this element may appear at the top of the document.
    */
    top?: boolean;
    /**
    Allowed attributes in this element. Strings refer to attributes
    specified in [`XMLConfig.attrs`](https://codemirror.net/6/docs/ref/#lang-xml.XMLConfig.attrs), but
    you can also provide one-off [attribute
    specs](https://codemirror.net/6/docs/ref/#lang-xml.AttrSpec). Attributes marked as
    [`global`](https://codemirror.net/6/docs/ref/#lang-xml.AttrSpec.global) are allowed in every
    element, and don't have to be mentioned here.
    */
    attributes?: readonly (string | AttrSpec)[];
    /**
    Can be provided to add extra fields to the
    [completion](https://codemirror.net/6/docs/ref/#autocompletion.Completion) object created for this
    element.
    */
    completion?: Partial<Completion>;
}
/**
Describes an attribute in your XML schema.
*/
interface AttrSpec {
    /**
    The attribute name.
    */
    name: string;
    /**
    Pre-defined values to complete for this attribute.
    */
    values?: readonly (string | Completion)[];
    /**
    When `true`, this attribute can be added to all elements.
    */
    global?: boolean;
    /**
    Provides extra fields to the
    [completion](https://codemirror.net/6/docs/ref/#autocompletion.Completion) object created for this
    element
    */
    completion?: Partial<Completion>;
}
/**
Create a completion source for the given schema.
*/
declare function completeFromSchema(eltSpecs: readonly ElementSpec[], attrSpecs: readonly AttrSpec[]): CompletionSource;

/**
A language provider based on the [Lezer XML
parser](https://github.com/lezer-parser/xml), extended with
highlighting and indentation information.
*/
declare const xmlLanguage: LRLanguage;
type XMLConfig = {
    /**
    Provide a schema to create completions from.
    */
    elements?: readonly ElementSpec[];
    /**
    Supporting attribute descriptions for the schema specified in
    [`elements`](https://codemirror.net/6/docs/ref/#lang-xml.xml^conf.elements).
    */
    attributes?: readonly AttrSpec[];
    /**
    Determines whether [`autoCloseTags`](https://codemirror.net/6/docs/ref/#lang-xml.autoCloseTags)
    is included in the support extensions. Defaults to true.
    */
    autoCloseTags?: boolean;
};
/**
XML language support. Includes schema-based autocompletion when
configured.
*/
declare function xml(conf?: XMLConfig): LanguageSupport;
/**
Extension that will automatically insert close tags when a `>` or
`/` is typed.
*/
declare const autoCloseTags: _codemirror_state.Extension;

export { type AttrSpec, type ElementSpec, autoCloseTags, completeFromSchema, xml, xmlLanguage };
