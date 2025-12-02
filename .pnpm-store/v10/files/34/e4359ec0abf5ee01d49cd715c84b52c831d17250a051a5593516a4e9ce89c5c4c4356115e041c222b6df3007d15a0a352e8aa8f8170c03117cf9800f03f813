import * as ts from 'typescript';
import { SymbolDisplayPart } from 'typescript';
export interface StringIndexedObject<T> {
    [key: string]: T;
}
export interface ComponentDoc {
    expression?: ts.Symbol;
    rootExpression?: ts.Symbol;
    displayName: string;
    filePath: string;
    description: string;
    props: Props;
    methods: Method[];
    tags?: StringIndexedObject<string>;
}
export interface Props extends StringIndexedObject<PropItem> {
}
export interface PropItem {
    name: string;
    required: boolean;
    type: PropItemType;
    description: string;
    defaultValue: any;
    parent?: ParentType;
    declarations?: ParentType[];
    tags?: {};
}
export interface Method {
    name: string;
    docblock: string;
    modifiers: string[];
    params: MethodParameter[];
    returns?: {
        description?: string | null;
        type?: string;
    } | null;
    description: string;
}
export interface MethodParameter {
    name: string;
    description?: string | null;
    type: MethodParameterType;
}
export interface MethodParameterType {
    name: string;
}
export interface Component {
    name: string;
}
export interface PropItemType {
    name: string;
    value?: any;
    raw?: string;
}
export interface ParentType {
    name: string;
    fileName: string;
}
export declare type PropFilter = (props: PropItem, component: Component) => boolean;
export declare type ComponentNameResolver = (exp: ts.Symbol, source: ts.SourceFile) => string | undefined | null | false;
export interface ParserOptions {
    propFilter?: StaticPropFilter | PropFilter;
    componentNameResolver?: ComponentNameResolver;
    shouldExtractLiteralValuesFromEnum?: boolean;
    shouldRemoveUndefinedFromOptional?: boolean;
    shouldExtractValuesFromUnion?: boolean;
    shouldSortUnions?: boolean;
    skipChildrenPropWithoutDoc?: boolean;
    savePropValueAsString?: boolean;
    shouldIncludePropTagMap?: boolean;
    shouldIncludeExpression?: boolean;
    customComponentTypes?: string[];
}
export interface StaticPropFilter {
    skipPropsWithName?: string[] | string;
    skipPropsWithoutDoc?: boolean;
}
export declare const defaultParserOpts: ParserOptions;
export interface FileParser {
    parse(filePathOrPaths: string | string[]): ComponentDoc[];
    parseWithProgramProvider(filePathOrPaths: string | string[], programProvider?: () => ts.Program): ComponentDoc[];
}
export declare const defaultOptions: ts.CompilerOptions;
/**
 * Parses a file with default TS options
 * @param filePathOrPaths component file that should be parsed
 * @param parserOpts options used to parse the files
 */
export declare function parse(filePathOrPaths: string | string[], parserOpts?: ParserOptions): ComponentDoc[];
/**
 * Constructs a parser for a default configuration.
 */
export declare function withDefaultConfig(parserOpts?: ParserOptions): FileParser;
/**
 * Constructs a parser for a specified tsconfig file.
 */
export declare function withCustomConfig(tsconfigPath: string, parserOpts: ParserOptions): FileParser;
/**
 * Constructs a parser for a specified set of TS compiler options.
 */
export declare function withCompilerOptions(compilerOptions: ts.CompilerOptions, parserOpts?: ParserOptions): FileParser;
interface JSDoc {
    description: string;
    fullComment: string;
    tags: StringIndexedObject<string>;
}
export declare class Parser {
    private readonly checker;
    private readonly propFilter;
    private readonly shouldRemoveUndefinedFromOptional;
    private readonly shouldExtractLiteralValuesFromEnum;
    private readonly shouldExtractValuesFromUnion;
    private readonly shouldSortUnions;
    private readonly savePropValueAsString;
    private readonly shouldIncludePropTagMap;
    private readonly shouldIncludeExpression;
    private propertiesOfPropsCache;
    private componentsInfoCache;
    constructor(program: ts.Program, opts: ParserOptions);
    getTypeSymbol(exp: ts.Symbol): ts.Symbol;
    isPlainObjectType(exp: ts.Symbol): boolean;
    /**
     * Attempts to gather a symbol's exports.
     * Some symbol's like `default` exports are aliased, so we need to get the real symbol.
     * @param exp symbol
     */
    getComponentExports(exp: ts.Symbol): {
        symbol: ts.Symbol;
        exports: ts.SymbolTable;
    } | undefined;
    private getComponentFromExpression;
    getComponentInfo(exp: ts.Symbol, source: ts.SourceFile, componentNameResolver?: ComponentNameResolver, customComponentTypes?: ParserOptions['customComponentTypes']): ComponentDoc | null;
    extractPropsFromTypeIfStatelessComponent(type: ts.Type): ts.Symbol | null;
    extractPropsFromTypeIfStatefulComponent(type: ts.Type): ts.Symbol | null;
    extractMembersFromType(type: ts.Type): ts.Symbol[];
    getMethodsInfo(type: ts.Type): Method[];
    getModifiers(member: ts.Symbol): string[];
    getParameterInfo(callSignature: ts.Signature): MethodParameter[];
    getCallSignature(symbol: ts.Symbol): ts.Signature;
    isTaggedPublic(symbol: ts.Symbol): boolean;
    getReturnDescription(symbol: ts.Symbol): SymbolDisplayPart[] | undefined;
    private getValuesFromUnionType;
    private getInfoFromUnionType;
    getDocgenType(propType: ts.Type, isRequired: boolean): PropItemType;
    getPropsInfo(propsObj: ts.Symbol, defaultProps?: StringIndexedObject<string>): Props;
    findDocComment(symbol: ts.Symbol): JSDoc;
    /**
     * Extracts a full JsDoc comment from a symbol, even
     * though TypeScript has broken down the JsDoc comment into plain
     * text and JsDoc tags.
     */
    getFullJsDocComment(symbol: ts.Symbol): JSDoc;
    getFunctionStatement(statement: ts.Statement): ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | undefined;
    extractDefaultPropsFromComponent(symbol: ts.Symbol, source: ts.SourceFile): {};
    getLiteralValueFromImportSpecifier(property: ts.ImportSpecifier): string | boolean | number | null | undefined;
    getLiteralValueFromPropertyAssignment(property: ts.PropertyAssignment | ts.BindingElement): string | boolean | number | null | undefined;
    getPropMap(properties: ts.NodeArray<ts.PropertyAssignment | ts.BindingElement>): StringIndexedObject<string | boolean | number | null>;
}
export declare function getDefaultExportForFile(source: ts.SourceFile): string;
export {};
