"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var parser_1 = require("../parser");
var testUtils_1 = require("./testUtils");
describe('parser', function () {
    it('should parse simple react class component', function () {
        testUtils_1.check('Column', {
            Column: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                prop3: { type: '() => void' },
                prop4: { type: '"option1" | "option2" | "option3"' }
            }
        });
    });
    it('should parse simple react class component with console.log inside', function () {
        testUtils_1.check('ColumnWithLog', {
            Column: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                prop3: { type: '() => void' },
                prop4: { type: '"option1" | "option2" | "option3"' }
            }
        });
    });
    it('should parse simple react class component as default export', function () {
        testUtils_1.check('ColumnWithDefaultExport', {
            Column: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                prop3: { type: '() => void' },
                prop4: { type: '"option1" | "option2" | "option3"' }
            }
        });
    });
    it('should parse simple typescript definition file with default export', function () {
        testUtils_1.check('StatelessDisplayNameFolder/Stateless.d.ts', {
            Stateless: {
                foo: { description: '', type: 'string', required: false }
            }
        }, true, '');
    });
    describe('file path', function () {
        it('should return the correct filepath for a parsed component', function () {
            var results = parser_1.parse([testUtils_1.fixturePath('FilePathCheck')]);
            results.forEach(function (result) {
                chai_1.assert.equal(result.filePath, path.resolve('src/__tests__/data/FilePathCheck.tsx'));
            });
        });
        it('should return the correct filepath for multiple parsed components', function () {
            var results = parser_1.parse([
                testUtils_1.fixturePath('FilePathCheck'),
                testUtils_1.fixturePath('Column'),
                testUtils_1.fixturePath('ColumnWithDefaultExportOnly')
            ]);
            var paths = [
                path.resolve('src/__tests__/data/FilePathCheck.tsx'),
                path.resolve('src/__tests__/data/Column.tsx'),
                path.resolve('src/__tests__/data/ColumnWithDefaultExportOnly.tsx')
            ];
            results.forEach(function (result, index) {
                chai_1.assert.equal(result.filePath, paths[index]);
            });
        });
    });
    it('should parse mulitple files', function () {
        var result = parser_1.parse([
            testUtils_1.fixturePath('Column'),
            testUtils_1.fixturePath('ColumnWithDefaultExportOnly')
        ]);
        testUtils_1.checkComponent(result, {
            Column: {},
            ColumnWithDefaultExportOnly: {}
        }, false);
    });
    it('should parse simple react class component as default export only', function () {
        testUtils_1.check('ColumnWithDefaultExportOnly', {
            ColumnWithDefaultExportOnly: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                prop3: { type: '() => void' },
                prop4: { type: '"option1" | "option2" | "option3"' }
            }
        });
    });
    it('should parse simple react class component as default anonymous export', function () {
        testUtils_1.check('ColumnWithDefaultAnonymousExportOnly', {
            ColumnWithDefaultAnonymousExportOnly: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                prop3: { type: '() => void' },
                prop4: { type: '"option1" | "option2" | "option3"' }
            }
        });
    });
    it('should parse simple react class component with state', function () {
        testUtils_1.check('AppMenu', {
            AppMenu: {
                menu: { type: 'any' }
            }
        });
    });
    it('should parse simple react class component with picked properties', function () {
        testUtils_1.check('ColumnWithPick', {
            Column: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                propx: { type: 'number' }
            }
        });
    });
    it('should parse component with props with external type', function () {
        testUtils_1.check('ColumnWithPropsWithExternalType', {
            ColumnWithPropsWithExternalType: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                prop3: { type: 'MyExternalType' }
            }
        });
    });
    it('should parse HOCs', function () {
        testUtils_1.check('ColumnHigherOrderComponent', {
            ColumnExternalHigherOrderComponent: {
                prop1: { type: 'string' }
            },
            ColumnHigherOrderComponent1: {
                prop1: { type: 'string' }
            },
            ColumnHigherOrderComponent2: {
                prop1: { type: 'string' }
            },
            RowExternalHigherOrderComponent: {
                prop1: { type: 'string' }
            },
            RowHigherOrderComponent1: {
                prop1: { type: 'string' }
            },
            RowHigherOrderComponent2: {
                prop1: { type: 'string' }
            }
        });
    });
    it('should parse component with inherited properties HtmlAttributes<any>', function () {
        testUtils_1.check('ColumnWithHtmlAttributes', {
            Column: {
                // tslint:disable:object-literal-sort-keys
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' },
                // HtmlAttributes
                defaultChecked: {
                    type: 'boolean',
                    required: false,
                    description: ''
                }
                // ...
                // tslint:enable:object-literal-sort-keys
            }
        }, false);
    });
    it('should parse component without exported props interface', function () {
        testUtils_1.check('ColumnWithoutExportedProps', {
            Column: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' }
            }
        });
    });
    it('should parse functional component exported as const', function () {
        testUtils_1.check('ConstExport', {
            Row: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' }
            },
            // TODO: this wasn't there before, i would guess that that's correct
            test: {}
        }, false);
    });
    it('should parse react component with properties defined in external file', function () {
        testUtils_1.check('ExternalPropsComponent', {
            ExternalPropsComponent: {
                prop1: { type: 'string' }
            }
        });
    });
    it('should parse static sub components', function () {
        testUtils_1.check('StatelessStaticComponents', {
            StatelessStaticComponents: {
                myProp: { type: 'string' }
            },
            'StatelessStaticComponents.Label': {
                title: { type: 'string' }
            }
        });
    });
    it('should parse static exported components variation1', function () {
        testUtils_1.check('StatelessStaticComponentsExportVariation1', {
            StatelessStaticComponents: {
                myProp: { type: 'string' }
            },
            'StatelessStaticComponents.Label': {
                title: { type: 'string' }
            }
        });
    });
    it('should parse static exported components variation2', function () {
        testUtils_1.check('StatelessStaticComponentsExportVariation2', {
            StatelessStaticComponents: {
                myProp: { type: 'string' }
            },
            'StatelessStaticComponents.Label': {
                title: { type: 'string' }
            }
        });
    });
    it('should parse static sub components exported from named object', function () {
        testUtils_1.check('StatelessStaticComponentsNamedObjectExport', {
            StatelessStaticComponents: {
                myProp: { type: 'string' }
            },
            SubComponent: {
                title: { type: 'string' }
            }
        }, true, '');
    });
    it('should parse static sub components exported from named object with keys', function () {
        testUtils_1.check('StatelessStaticComponentsNamedObjectExportAsKeys', {
            StatelessStaticComponents: {
                myProp: { type: 'string' }
            },
            SubComponent: {
                title: { type: 'string' }
            }
        });
    });
    it('should parse static sub components on class components', function () {
        testUtils_1.check('ColumnWithStaticComponents', {
            Column: {
                prop1: { type: 'string' }
            },
            'Column.Label': {
                title: { type: 'string' }
            },
            'Column.SubLabel': {}
        });
    });
    it('should parse react component with properties extended from an external .tsx file', function () {
        testUtils_1.check('ExtendsExternalPropsComponent', {
            ExtendsExternalPropsComponent: {
                prop1: { type: 'number', required: false, description: 'prop1' },
                prop2: { type: 'string', required: false, description: 'prop2' }
            }
        });
    });
    it('should parse react component with properties defined as type', function () {
        testUtils_1.check('FlippableImage', {
            FlippableImage: {
                isFlippedX: { type: 'boolean', required: false },
                isFlippedY: { type: 'boolean', required: false }
            }
        }, false);
    });
    it('should parse react component with const definitions', function () {
        testUtils_1.check('InlineConst', {
            MyComponent: {
                foo: { type: 'any' }
            }
        });
    });
    it('should parse default interface export', function () {
        testUtils_1.check('ExportsDefaultInterface', {
            Component: {
                foo: { type: 'any' }
            }
        });
    });
    it('should parse react component that exports a prop type const', function () {
        testUtils_1.check('ExportsPropTypeShape', {
            ExportsPropTypes: {
                foo: { type: 'any' }
            }
        });
    });
    it('should parse react component that exports a prop type thats imported', function () {
        testUtils_1.check('ExportsPropTypeImport', {
            ExportsPropTypes: {
                foo: { type: 'any' }
            }
        });
    });
    // see issue #132 (https://github.com/styleguidist/react-docgen-typescript/issues/132)
    it('should determine the parent fileName relative to the project directory', function () {
        testUtils_1.check('ExportsPropTypeImport', {
            ExportsPropTypes: {
                foo: {
                    parent: {
                        fileName: 'react-docgen-typescript/src/__tests__/data/ExportsPropTypeImport.tsx',
                        name: 'ExportsPropTypesProps'
                    },
                    type: 'any'
                }
            }
        }, true);
    });
    describe('component with default props', function () {
        var expectation = {
            ComponentWithDefaultProps: {
                sampleDefaultFromJSDoc: {
                    defaultValue: 'hello',
                    description: 'sample with default value',
                    required: true,
                    type: '"hello" | "goodbye"'
                },
                sampleFalse: {
                    defaultValue: false,
                    required: false,
                    type: 'boolean'
                },
                sampleNull: { type: 'null', required: false, defaultValue: null },
                sampleNumber: { type: 'number', required: false, defaultValue: -1 },
                sampleObject: {
                    defaultValue: "{ a: '1', b: 2, c: true, d: false, e: undefined, f: null, g: { a: '1' } }",
                    required: false,
                    type: '{ [key: string]: any; }'
                },
                sampleString: {
                    defaultValue: 'hello',
                    required: false,
                    type: 'string'
                },
                sampleTrue: { type: 'boolean', required: false, defaultValue: true },
                sampleUndefined: {
                    defaultValue: 'undefined',
                    required: false,
                    type: 'any'
                }
            }
        };
        it('should parse defined props', function () {
            testUtils_1.check('ComponentWithDefaultProps', expectation);
        });
        it('should parse referenced props', function () {
            testUtils_1.check('ComponentWithReferencedDefaultProps', expectation);
        });
    });
    describe('component with @type jsdoc tag', function () {
        var expectation = {
            ComponentWithTypeJsDocTag: {
                sampleTypeFromJSDoc: {
                    description: 'sample with custom type',
                    required: true,
                    type: 'string'
                }
            }
        };
        it('should parse defined props', function () {
            testUtils_1.check('ComponentWithTypeJsDocTag', expectation);
        });
    });
    it('should parse react PureComponent', function () {
        testUtils_1.check('PureRow', {
            Row: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' }
            }
        });
    });
    it('should parse react PureComponent - regression test', function () {
        testUtils_1.check('Regression_v0_0_12', {
            Zoomable: {
                originX: { type: 'number' },
                originY: { type: 'number' },
                scaleFactor: { type: 'number' }
            }
        }, false);
    });
    it('should parse react functional component', function () {
        testUtils_1.check('Row', {
            Row: {
                prop1: { type: 'string', required: false },
                prop2: { type: 'number' }
            }
        });
    });
    it('should parse react stateless component', function () {
        testUtils_1.check('Stateless', {
            Stateless: {
                myProp: { type: 'string' }
            }
        });
    });
    it('should get name for default export', function () {
        testUtils_1.check('ForwardRefDefaultExport', {
            ForwardRefDefaultExport: {
                myProp: { type: 'string' }
            }
        }, false);
    });
    it('should get name for default export 2', function () {
        testUtils_1.check('ForwardRefDefaultExportAtExport', {
            ForwardRefDefaultExport: {
                myProp: { type: 'string' }
            }
        }, false);
    });
    it('should component where last line is a comment', function () {
        testUtils_1.check('ExportObject', {
            Baz: {
                baz: { description: '', type: 'string' }
            },
            Bar: {
                foo: { description: '', type: 'string' }
            },
            FooBar: {
                foobar: { description: '', type: 'string' }
            }
        });
    });
    it('should parse react stateless component with intersection props', function () {
        testUtils_1.check('StatelessIntersectionProps', {
            StatelessIntersectionProps: {
                moreProp: { type: 'number' },
                myProp: { type: 'string' }
            }
        });
    });
    it('should parse react stateless component default props when declared as a normal function', function () {
        testUtils_1.check('FunctionDeclarationDefaultProps', {
            FunctionDeclarationDefaultProps: {
                id: {
                    defaultValue: 1,
                    description: '',
                    required: false,
                    type: 'number'
                }
            }
        });
    });
    it('should parse react stateless component default props when declared as a normal function inside forwardRef', function () {
        testUtils_1.check('ForwardRefDefaultValues', {
            ForwardRefDefaultValues: {
                myProp: {
                    defaultValue: "I'm default",
                    description: 'myProp description',
                    type: 'string',
                    required: false
                }
            }
        }, false, 'ForwardRefDefaultValues description');
    });
    it('should parse react stateless component with external intersection props', function () {
        testUtils_1.check('StatelessIntersectionExternalProps', {
            StatelessIntersectionExternalProps: {
                myProp: { type: 'string' },
                prop1: { type: 'string', required: false }
            }
        });
    });
    it('should parse react stateless component with generic intersection props', function () {
        testUtils_1.check('StatelessIntersectionGenericProps', {
            StatelessIntersectionGenericProps: {
                myProp: { type: 'string' }
            }
        });
    });
    it('should parse react stateless component with intersection + union props', function () {
        testUtils_1.check('SimpleUnionIntersection', {
            SimpleUnionIntersection: {
                bar: { type: 'string', description: '' },
                baz: { type: 'string', description: '' },
                foo: { type: 'string', description: '' }
            }
        });
    });
    it('should parse react stateless component with intersection + union overlap props', function () {
        testUtils_1.check('SimpleDiscriminatedUnionIntersection', {
            SimpleDiscriminatedUnionIntersection: {
                bar: { type: '"one" | "other"', description: '' },
                baz: { type: 'number', description: '' },
                foo: { type: 'string', description: '' },
                test: { type: 'number', description: '' }
            }
        });
    });
    it('should parse react stateless component with generic intersection + union overlap props - simple', function () {
        testUtils_1.check('SimpleGenericUnionIntersection', {
            SimpleGenericUnionIntersection: {
                as: { type: 'unknown', description: '' },
                foo: {
                    description: 'The foo prop should not repeat the description',
                    required: false,
                    type: '"red" | "blue"'
                },
                gap: {
                    description: 'The space between children\nYou cannot use gap when using a "space" justify property',
                    required: false,
                    type: 'number'
                },
                hasWrap: { type: 'boolean', description: '', required: false }
            }
        });
    });
    it('should parse react stateless component with generic intersection + union overlap props', function () {
        testUtils_1.check('ComplexGenericUnionIntersection', {
            ComplexGenericUnionIntersection: {
                as: {
                    type: 'ElementType<any>',
                    required: false,
                    description: 'Render the component as another component'
                },
                align: {
                    description: 'The flex "align" property',
                    required: false,
                    type: '"stretch" | "center" | "flex-start" | "flex-end"'
                },
                justify: {
                    description: "Use flex 'center' | 'flex-start' | 'flex-end' | 'stretch' with\na gap between each child.\nUse flex 'space-between' | 'space-around' | 'space-evenly' and\nflex will space the children.",
                    required: false,
                    type: '"stretch" | "center" | "flex-start" | "flex-end" | "space-between" | "space-around" | "space-evenly"'
                },
                gap: {
                    description: 'The space between children\nYou cannot use gap when using a "space" justify property',
                    required: false,
                    type: 'string | number'
                }
            }
        });
    });
    it('should parse react stateless component with generic intersection + union + omit overlap props', function () {
        testUtils_1.check('ComplexGenericUnionIntersectionWithOmit', {
            ComplexGenericUnionIntersectionWithOmit: {
                as: {
                    type: 'ElementType<any>',
                    required: false,
                    description: 'Render the component as another component'
                },
                align: {
                    description: 'The flex "align" property',
                    required: false,
                    type: '"center" | "flex-start" | "flex-end" | "stretch"'
                },
                justify: {
                    description: "Use flex 'center' | 'flex-start' | 'flex-end' | 'stretch' with\na gap between each child.\nUse flex 'space-between' | 'space-around' | 'space-evenly' and\nflex will space the children.",
                    required: false,
                    type: '"center" | "flex-start" | "flex-end" | "stretch" | "space-between" | "space-around" | "space-evenly"'
                },
                gap: {
                    description: 'The space between children\nYou cannot use gap when using a "space" justify property',
                    required: false,
                    type: 'string | number'
                }
            }
        });
    });
    it('should parse react stateful component with intersection props', function () {
        testUtils_1.check('StatefulIntersectionProps', {
            StatefulIntersectionProps: {
                moreProp: { type: 'number' },
                myProp: { type: 'string' }
            }
        });
    });
    it('should parse react stateful component with external intersection props', function () {
        testUtils_1.check('StatefulIntersectionExternalProps', {
            StatefulIntersectionExternalProps: {
                myProp: { type: 'string' },
                prop1: { type: 'string', required: false }
            }
        });
    });
    it('should parse react stateful component (wrapped in HOC) with intersection props', function () {
        testUtils_1.check('HOCIntersectionProps', {
            HOCIntersectionProps: {
                injected: { type: 'boolean' },
                myProp: { type: 'string' }
            }
        });
    });
    describe('stateless component with default props', function () {
        var expectation = {
            StatelessWithDefaultProps: {
                sampleDefaultFromJSDoc: {
                    defaultValue: 'hello',
                    description: 'sample with default value',
                    required: true,
                    type: '"hello" | "goodbye"'
                },
                sampleEnum: {
                    defaultValue: 'enumSample.HELLO',
                    required: false,
                    type: 'enumSample'
                },
                sampleFalse: {
                    defaultValue: false,
                    required: false,
                    type: 'boolean'
                },
                sampleNull: { type: 'null', required: false, defaultValue: null },
                sampleNumber: { type: 'number', required: false, defaultValue: -1 },
                sampleObject: {
                    defaultValue: "{ a: '1', b: 2, c: true, d: false, e: undefined, f: null, g: { a: '1' } }",
                    required: false,
                    type: '{ [key: string]: any; }'
                },
                sampleString: {
                    defaultValue: 'hello',
                    required: false,
                    type: 'string'
                },
                sampleTrue: { type: 'boolean', required: false, defaultValue: true },
                sampleUndefined: {
                    defaultValue: undefined,
                    required: false,
                    type: 'any'
                },
                sampleRenamed: {
                    defaultValue: 'world',
                    required: false,
                    type: 'string'
                }
            }
        };
        it('should parse defined props', function () {
            testUtils_1.check('StatelessWithDefaultProps', expectation);
        });
        it('should parse props with shorthands', function () {
            testUtils_1.check('StatelessShorthandDefaultProps', {
                StatelessShorthandDefaultProps: {
                    onCallback: {
                        defaultValue: null,
                        description: 'onCallback description',
                        required: false,
                        type: '() => void'
                    },
                    regularProp: {
                        defaultValue: 'foo',
                        description: 'regularProp description',
                        required: false,
                        type: 'string'
                    },
                    shorthandProp: {
                        defaultValue: 123,
                        description: 'shorthandProp description',
                        required: false,
                        type: 'number'
                    }
                }
            });
        });
        it('supports destructuring', function () {
            testUtils_1.check('StatelessWithDestructuredProps', expectation);
        });
        it('supports destructuring for arrow functions', function () {
            testUtils_1.check('StatelessWithDestructuredPropsArrow', expectation);
        });
        it('supports typescript 3.0 style defaulted props', function () {
            testUtils_1.check('StatelessWithDefaultPropsTypescript3', expectation);
        });
    });
    it('should parse components with unioned types', function () {
        testUtils_1.check('OnlyDefaultExportUnion', {
            OnlyDefaultExportUnion: {
                content: { description: 'The content', type: 'string' }
            }
        });
    });
    it('should parse components with unioned types when re-exported as named export', function () {
        testUtils_1.check('OnlyDefaultExportUnionAsExport', {
            OnlyDefaultExportUnion: {
                content: { description: 'The content', type: 'string' }
            }
        }, true, 'OnlyDefaultExportUnion description');
    });
    it('should parse jsdocs with the @default tag and no description', function () {
        testUtils_1.check('StatelessWithDefaultOnlyJsDoc', {
            StatelessWithDefaultOnlyJsDoc: {
                myProp: { defaultValue: 'hello', description: '', type: 'string' }
            }
        });
    });
    it('should parse functional component component defined as function', function () {
        testUtils_1.check('FunctionDeclaration', {
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        });
    });
    it('should parse functional component component defined as const', function () {
        testUtils_1.check('FunctionalComponentAsConst', {
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        });
    });
    it('should parse functional component declared as React.FC with default import from react', function () {
        testUtils_1.check('FunctionalComponentWithDefaultImportReact', {
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        });
    });
    it('should parse functional component defined as const with default value assignments in immediately destructured props', function () {
        testUtils_1.check('FunctionalComponentWithDesctructuredProps', {
            FunctionalComponentWithDesctructuredProps: {
                prop1: {
                    type: 'Property1Type',
                    required: false,
                    defaultValue: 'hello'
                },
                prop2: {
                    type: '"goodbye" | "farewell"',
                    required: false,
                    defaultValue: 'goodbye'
                },
                prop3: {
                    type: 'number',
                    required: false,
                    defaultValue: 10
                },
                prop4: {
                    type: 'string',
                    required: false,
                    defaultValue: 'this is a string'
                },
                prop5: {
                    type: 'boolean',
                    required: false,
                    defaultValue: true
                }
            }
        });
    });
    it('should parse functional component defined as const with default value (imported from a separate file) assignments in immediately destructured props', function () {
        testUtils_1.check('FunctionalComponentWithDesctructuredPropsAndImportedConstants', {
            FunctionalComponentWithDesctructuredPropsAndImportedConstants: {
                prop1: {
                    type: 'Property1Type',
                    required: false,
                    defaultValue: 'hello'
                },
                prop2: {
                    type: '"goodbye" | "farewell"',
                    required: false,
                    defaultValue: 'goodbye'
                },
                prop3: {
                    type: 'number',
                    required: false,
                    defaultValue: 10
                },
                prop4: {
                    type: 'string',
                    required: false,
                    defaultValue: 'this is a string'
                },
                prop5: {
                    type: 'boolean',
                    required: false,
                    defaultValue: true
                }
            }
        });
    });
    it('should parse functional component component defined as const', function () {
        testUtils_1.check('FunctionDeclarationVisibleName', {
            'Awesome Jumbotron': {
                prop1: { type: 'string', required: true }
            }
        });
    });
    it('should parse React.SFC component defined as const', function () {
        testUtils_1.check('ReactSFCAsConst', {
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        });
    });
    it('should parse functional component component defined as function as default export', function () {
        testUtils_1.check('FunctionDeclarationAsDefaultExport', {
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        });
    });
    it('should parse functional component component thats been wrapped in React.memo', function () {
        testUtils_1.check('FunctionDeclarationAsDefaultExportWithMemo', {
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        });
    });
    it('should parse functional component component defined as const thats been wrapped in React.memo', function () {
        testUtils_1.check('FunctionDeclarationAsConstAsDefaultExportWithMemo', {
            // in this case the component name is taken from the file name
            FunctionDeclarationAsConstAsDefaultExportWithMemo: {
                prop1: { type: 'string', required: true }
            }
        }, true, 'Jumbotron description');
    });
    it('should parse JSDoc correctly', function () {
        testUtils_1.check('JSDocWithParam', {
            JSDocWithParam: {
                prop1: { type: 'string', required: true }
            }
        }, true, 'JSDocWithParamProps description\n\nNOTE: If a parent element of this control is `overflow: hidden` then the\nballoon may not show up.');
    });
    it('should parse functional component component defined as const as default export', function () {
        testUtils_1.check('FunctionalComponentAsConstAsDefaultExport', {
            // in this case the component name is taken from the file name
            FunctionalComponentAsConstAsDefaultExport: {
                prop1: { type: 'string', required: true }
            }
        }, true, 'Jumbotron description');
    });
    it('should parse React.SFC component defined as const as default export', function () {
        testUtils_1.check('ReactSFCAsConstAsDefaultExport', {
            // in this case the component name is taken from the file name
            ReactSFCAsConstAsDefaultExport: {
                prop1: { type: 'string', required: true }
            }
        }, true, 'Jumbotron description');
    });
    it('should parse functional component component defined as const as named export', function () {
        testUtils_1.check('FunctionalComponentAsConstAsNamedExport', {
            // in this case the component name is taken from the file name
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        }, true, 'Jumbotron description');
    });
    it('should parse React.SFC component defined as const as named export', function () {
        testUtils_1.check('ReactSFCAsConstAsNamedExport', {
            // in this case the component name is taken from the file name
            Jumbotron: {
                prop1: { type: 'string', required: true }
            }
        }, true, 'Jumbotron description');
    });
    describe('displayName', function () {
        it('should be taken from stateless component `displayName` property (using named export)', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayName'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatelessDisplayName');
        });
        it('should be taken from stateful component `displayName` property (using named export)', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatefulDisplayName'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatefulDisplayName');
        });
        it('should be taken from stateless component `displayName` property (using default export)', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayNameDefaultExport'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatelessDisplayNameDefaultExport');
        });
        it("should be taken from stateless component `displayName` property (using default export) even if file name doesn't match", function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayNameDefaultExportDifferentFilename'))[0];
            chai_1.assert.equal(parsed.displayName, 'ThisNameIsNotTheSameAsThisFilename');
        });
        it('should be taken from stateful component `displayName` property (using default export)', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatefulDisplayNameDefaultExport'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatefulDisplayNameDefaultExport');
        });
        it('should be taken from named export when default export is an HOC', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayNameHOC'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatelessDisplayName');
        });
        it('should be taken from named export when default export is an HOC', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatefulDisplayNameHOC'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatefulDisplayName');
        });
        it('should be taken from stateless component folder name if file name is "index"', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayNameFolder/index'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatelessDisplayNameFolder');
        });
        it('should be taken from stateful component folder name if file name is "index"', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatefulDisplayNameFolder/index'))[0];
            chai_1.assert.equal(parsed.displayName, 'StatefulDisplayNameFolder');
        });
        describe('multiple components in one', function () {
            it('should parse all `displayName` properties correctly when all are explicitly defined.', function () {
                var result = parser_1.parse(testUtils_1.fixturePath('MultipleAllWithDisplayName'));
                // Ensure we're not missing any exports.
                chai_1.assert.equal(result.length, 3);
                var parsed1 = result[0], parsed2 = result[1], parsed3 = result[2];
                chai_1.assert.equal(parsed1.displayName, 'First');
                chai_1.assert.equal(parsed2.displayName, 'Second');
                chai_1.assert.equal(parsed3.displayName, 'Third');
            });
            it('should parse all `displayName` properties correctly when some are explicitly defined.', function () {
                var result = parser_1.parse(testUtils_1.fixturePath('MultipleSomeWithDisplayName'));
                // Ensure we're not missing any exports.
                chai_1.assert.equal(result.length, 4);
                var parsed1 = result[0], parsed2 = result[1], parsed3 = result[2], parsed4 = result[3];
                chai_1.assert.equal(parsed1.displayName, 'First');
                chai_1.assert.equal(parsed2.displayName, 'NoExplicitDisplayName1');
                chai_1.assert.equal(parsed3.displayName, 'Second');
                chai_1.assert.equal(parsed4.displayName, 'NoExplicitDisplayName2');
            });
            it('should parse all `displayName` properties correctly when none are explicitly defined.', function () {
                var result = parser_1.parse(testUtils_1.fixturePath('MultipleWithNoExplicitDisplayName'));
                // Ensure we're not missing any exports.
                chai_1.assert.equal(result.length, 3);
                var parsed1 = result[0], parsed2 = result[1], parsed3 = result[2];
                chai_1.assert.equal(parsed1.displayName, 'Button');
                chai_1.assert.equal(parsed2.displayName, 'SubmitButton');
                chai_1.assert.equal(parsed3.displayName, 'ResetButton');
            });
        });
    });
    describe('Parser options', function () {
        describe('Property filtering', function () {
            describe('children', function () {
                it('should ignore property "children" if not explicitly documented', function () {
                    testUtils_1.check('Column', {
                        Column: {
                            prop1: { type: 'string', required: false },
                            prop2: { type: 'number' },
                            prop3: { type: '() => void' },
                            prop4: { type: '"option1" | "option2" | "option3"' }
                        }
                    }, true);
                });
                it('should not ignore any property that is documented explicitly', function () {
                    testUtils_1.check('ColumnWithAnnotatedChildren', {
                        Column: {
                            children: {
                                description: 'children description',
                                required: false,
                                type: 'ReactNode'
                            },
                            prop1: { type: 'string', required: false },
                            prop2: { type: 'number' },
                            prop3: { type: '() => void' },
                            prop4: { type: '"option1" | "option2" | "option3"' }
                        }
                    }, true);
                });
            });
            describe('propsFilter method', function () {
                it('should apply filter function and filter components accordingly', function () {
                    var propFilter = function (prop, component) {
                        return prop.name !== 'prop1';
                    };
                    testUtils_1.check('Column', {
                        Column: {
                            prop2: { type: 'number' },
                            prop3: { type: '() => void' },
                            prop4: { type: '"option1" | "option2" | "option3"' }
                        }
                    }, true, undefined, { propFilter: propFilter });
                });
                it('should apply filter function and filter components accordingly', function () {
                    var propFilter = function (prop, component) {
                        if (component.name === 'Column') {
                            return prop.name !== 'prop1';
                        }
                        return true;
                    };
                    testUtils_1.check('Column', {
                        Column: {
                            prop2: { type: 'number' },
                            prop3: { type: '() => void' },
                            prop4: { type: '"option1" | "option2" | "option3"' }
                        }
                    }, true, undefined, { propFilter: propFilter });
                    testUtils_1.check('AppMenu', {
                        AppMenu: {
                            menu: { type: 'any' }
                        }
                    }, true, undefined, { propFilter: propFilter });
                });
                it('should allow filtering by parent interface', function () {
                    var propFilter = function (prop, component) {
                        if (prop.parent == null) {
                            return true;
                        }
                        return (prop.parent.fileName.indexOf('@types/react') < 0 &&
                            prop.parent.name !== 'HTMLAttributes');
                    };
                    testUtils_1.check('ColumnWithHtmlAttributes', {
                        Column: {
                            prop1: { type: 'string', required: false },
                            prop2: { type: 'number' }
                        }
                    }, true, undefined, { propFilter: propFilter });
                });
            });
            it('should collect all `onClick prop` parent declarations', function (done) {
                chai_1.assert.doesNotThrow(function () {
                    parser_1.withDefaultConfig({
                        propFilter: function (prop) {
                            if (prop.name === 'onClick') {
                                chai_1.assert.deepEqual(prop.declarations, [
                                    {
                                        fileName: 'react-docgen-typescript/node_modules/@types/react/index.d.ts',
                                        name: 'DOMAttributes'
                                    },
                                    {
                                        fileName: 'react-docgen-typescript/src/__tests__/data/ButtonWithOnClickComponent.tsx',
                                        name: 'TypeLiteral'
                                    }
                                ]);
                                done();
                            }
                            return true;
                        }
                    }).parse(testUtils_1.fixturePath('ButtonWithOnClickComponent'));
                });
            });
            it('should allow filtering by parent declarations', function () {
                var propFilter = function (prop) {
                    if (prop.declarations !== undefined && prop.declarations.length > 0) {
                        var hasPropAdditionalDescription = prop.declarations.find(function (declaration) {
                            return !declaration.fileName.includes('@types/react');
                        });
                        return Boolean(hasPropAdditionalDescription);
                    }
                    return true;
                };
                testUtils_1.check('ButtonWithOnClickComponent', {
                    ButtonWithOnClickComponent: {
                        onClick: {
                            type: 'MouseEventHandler<HTMLButtonElement>',
                            required: false,
                            description: 'onClick event handler'
                        }
                    }
                }, true, '', {
                    propFilter: propFilter
                });
            });
            describe('skipPropsWithName', function () {
                it('should skip a single property in skipPropsWithName', function () {
                    var propFilter = { skipPropsWithName: 'prop1' };
                    testUtils_1.check('Column', {
                        Column: {
                            prop2: { type: 'number' },
                            prop3: { type: '() => void' },
                            prop4: { type: '"option1" | "option2" | "option3"' }
                        }
                    }, true, undefined, { propFilter: propFilter });
                });
                it('should skip multiple properties in skipPropsWithName', function () {
                    var propFilter = { skipPropsWithName: ['prop1', 'prop2'] };
                    testUtils_1.check('Column', {
                        Column: {
                            prop3: { type: '() => void' },
                            prop4: { type: '"option1" | "option2" | "option3"' }
                        }
                    }, true, undefined, { propFilter: propFilter });
                });
            });
            describe('skipPropsWithoutDoc', function () {
                it('should skip a properties without documentation', function () {
                    var propFilter = { skipPropsWithoutDoc: false };
                    testUtils_1.check('ColumnWithUndocumentedProps', {
                        Column: {
                            prop1: { type: 'string', required: false },
                            prop2: { type: 'number' }
                        }
                    }, true, undefined, { propFilter: propFilter });
                });
            });
        });
        it('should defaultProps in variable', function () {
            testUtils_1.check('SeparateDefaultProps', {
                SeparateDefaultProps: {
                    disabled: {
                        description: '',
                        required: false,
                        defaultValue: false,
                        type: 'boolean'
                    },
                    id: {
                        description: '',
                        required: false,
                        defaultValue: 123,
                        type: 'number'
                    }
                }
            });
        });
        it('should defaultProps accessed variable', function () {
            testUtils_1.check('SeparateDefaultPropsIndividual', {
                SeparateDefaultPropsIndividual: {
                    disabled: {
                        description: '',
                        required: false,
                        defaultValue: false,
                        type: 'boolean'
                    },
                    id: {
                        description: '',
                        required: false,
                        defaultValue: 123,
                        type: 'number'
                    }
                }
            });
        });
        describe('Extracting literal values from enums', function () {
            it('extracts literal values from enum', function () {
                testUtils_1.check('ExtractLiteralValuesFromEnum', {
                    ExtractLiteralValuesFromEnum: {
                        sampleBoolean: { type: 'boolean' },
                        sampleEnum: {
                            raw: 'sampleEnum',
                            type: 'enum',
                            value: [
                                {
                                    value: '"one"',
                                    description: '',
                                    fullComment: '',
                                    tags: {}
                                },
                                {
                                    value: '"two"',
                                    description: '',
                                    fullComment: '',
                                    tags: {}
                                },
                                {
                                    value: '"three"',
                                    description: '',
                                    fullComment: '',
                                    tags: {}
                                }
                            ]
                        },
                        sampleString: { type: 'string' }
                    }
                }, true, null, {
                    shouldExtractLiteralValuesFromEnum: true
                });
            });
            it('Should infer types from constraint type (generic with extends)', function () {
                testUtils_1.check('GenericWithExtends', {
                    GenericWithExtends: {
                        sampleUnionProp: {
                            raw: 'SampleUnion',
                            type: 'enum',
                            value: [
                                {
                                    value: '"value 1"'
                                },
                                {
                                    value: '"value 2"'
                                },
                                {
                                    value: '"value 3"'
                                },
                                {
                                    value: '"value 4"'
                                },
                                {
                                    value: '"value n"'
                                }
                            ]
                        },
                        sampleEnumProp: {
                            raw: 'SampleEnum',
                            type: 'enum',
                            value: [
                                { value: '0', description: '', fullComment: '', tags: {} },
                                { value: '1', description: '', fullComment: '', tags: {} },
                                { value: '"c"', description: '', fullComment: '', tags: {} }
                            ]
                        },
                        sampleUnionNonGeneric: {
                            type: 'SampleUnionNonGeneric'
                        },
                        sampleObjectProp: {
                            type: 'SampleObject'
                        },
                        sampleNumberProp: {
                            type: 'number'
                        },
                        sampleGenericArray: {
                            type: 'number[]'
                        },
                        sampleGenericObject: {
                            type: '{ prop1: number; }'
                        },
                        sampleInlineObject: {
                            type: '{ propA: string; }'
                        }
                    }
                }, true, null, { shouldExtractLiteralValuesFromEnum: true });
            });
        });
        describe('Extracting values from unions', function () {
            it('extracts all values from union', function () {
                testUtils_1.check('ExtractLiteralValuesFromUnion', {
                    ExtractLiteralValuesFromUnion: {
                        sampleComplexUnion: {
                            raw: 'number | "string1" | "string2"',
                            type: 'enum',
                            value: [
                                { value: 'number' },
                                { value: '"string1"' },
                                { value: '"string2"' }
                            ]
                        }
                    }
                }, false, null, {
                    shouldExtractValuesFromUnion: true
                });
            });
            it('extracts numbers from a union', function () {
                testUtils_1.check('ExtractLiteralValuesFromUnion', {
                    ExtractLiteralValuesFromUnion: {
                        sampleNumberUnion: {
                            raw: '1 | 2 | 3',
                            type: 'enum',
                            value: [{ value: '1' }, { value: '2' }, { value: '3' }]
                        }
                    }
                }, false, null, {
                    shouldExtractValuesFromUnion: true
                });
            });
            it('extracts numbers and strings from a mixed union', function () {
                testUtils_1.check('ExtractLiteralValuesFromUnion', {
                    ExtractLiteralValuesFromUnion: {
                        sampleMixedUnion: {
                            raw: '"string1" | "string2" | 1 | 2',
                            type: 'enum',
                            value: [
                                { value: '"string1"' },
                                { value: '"string2"' },
                                { value: '1' },
                                { value: '2' }
                            ]
                        }
                    }
                }, false, null, {
                    shouldExtractValuesFromUnion: true
                });
            });
        });
        describe('Sorting unions', function () {
            it('does not sort union members by default', function () {
                testUtils_1.check('SimpleUnions', {
                    SimpleUnions: {
                        sampleUnionProp: {
                            raw: 'SampleUnion',
                            type: 'enum',
                            value: [
                                { value: '"h1"' },
                                { value: '"h6"' },
                                { value: '"h2"' },
                                { value: '"h4"' },
                                { value: '"h5"' },
                                { value: '"h3"' }
                            ]
                        }
                    }
                }, false, null, {
                    shouldExtractLiteralValuesFromEnum: true
                });
            });
            it('sorts union members when shouldSortUnions is true', function () {
                testUtils_1.check('SimpleUnions', {
                    SimpleUnions: {
                        sampleUnionProp: {
                            raw: 'SampleUnion',
                            type: 'enum',
                            value: [
                                { value: '"h1"' },
                                { value: '"h2"' },
                                { value: '"h3"' },
                                { value: '"h4"' },
                                { value: '"h5"' },
                                { value: '"h6"' }
                            ]
                        }
                    }
                }, false, null, {
                    shouldExtractLiteralValuesFromEnum: true,
                    shouldSortUnions: true
                });
            });
        });
        describe('Returning not string default props ', function () {
            it('returns not string defaultProps', function () {
                testUtils_1.check('StatelessWithDefaultPropsAsString', {
                    StatelessWithDefaultPropsAsString: {
                        sampleFalse: {
                            defaultValue: 'false',
                            required: false,
                            type: 'boolean'
                        },
                        sampleNull: {
                            defaultValue: 'null',
                            required: false,
                            type: 'null'
                        },
                        sampleNumber: {
                            defaultValue: '1',
                            required: false,
                            type: 'number'
                        },
                        sampleNumberWithPrefix: {
                            defaultValue: '-1',
                            required: false,
                            type: 'number'
                        },
                        sampleTrue: {
                            defaultValue: 'true',
                            required: false,
                            type: 'boolean'
                        },
                        sampleUndefined: {
                            defaultValue: 'undefined',
                            required: false,
                            type: 'undefined'
                        }
                    }
                }, true, null, {
                    savePropValueAsString: true
                });
            });
        });
        describe("Extract prop's JSDoc/TSDoc tags", function () {
            it('should extract all prop JSDoc/TSDoc tags', function () {
                testUtils_1.check('ExtractPropTags', {
                    ExtractPropTags: {
                        prop1: {
                            type: 'Pick<Todo, "title" | "completed">',
                            required: false,
                            tags: {
                                ignore: 'ignoreMe',
                                kind: 'category 2',
                                custom123: 'something'
                            }
                        },
                        prop2: {
                            type: 'string',
                            tags: { internal: 'some internal prop', kind: 'category 1' }
                        }
                    }
                }, true, null, { shouldIncludePropTagMap: true });
            });
        });
        describe('shouldIncludeExpression', function () {
            it('should be disabled by default', function () {
                var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayName'))[0];
                chai_1.assert.equal(parsed.expression, undefined);
                chai_1.assert.equal(parsed.expression, parsed.rootExpression);
            });
            it('should cause the parser to return the component expression when set to true', function () {
                var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayName'), {
                    shouldIncludeExpression: true
                })[0];
                chai_1.assert.equal(parsed.expression.name, 'Stateless');
                chai_1.assert.equal(parsed.expression, parsed.rootExpression);
            });
            it('should cause the parser to return the root expression when set to true', function () {
                var parsed = parser_1.parse(testUtils_1.fixturePath('FunctionDeclarationAsDefaultExportWithMemo'), {
                    shouldIncludeExpression: true
                })[0];
                chai_1.assert.equal(parsed.expression.name, 'Jumbotron');
                chai_1.assert.equal(parsed.rootExpression.name, 'default');
            });
        });
    });
    describe('withCustomConfig', function () {
        it('should accept tsconfigs that typescript accepts', function () {
            chai_1.assert.ok(parser_1.withCustomConfig(
            // need to navigate to root because tests run on compiled tests
            // and tsc does not include json files
            path.join(__dirname, '../../src/__tests__/data/tsconfig.json'), {}));
        });
    });
    describe('typescript strict mode', function () {
        // typescript strict mode adds an extra `undefined` to enums
        // may have other funky behavior
        describe('remove undefined from optional', function () {
            var options = {
                shouldExtractLiteralValuesFromEnum: true,
                shouldRemoveUndefinedFromOptional: true,
                savePropValueAsString: true
            };
            var parser = parser_1.withCustomConfig(
            // tsconfig with strict: true
            path.join(__dirname, '../../src/__tests__/data/tsconfig.json'), options);
            it('removes undefined from enums', function () {
                var result = parser.parse(testUtils_1.fixturePath('RemoveOptionalValuesFromEnum'));
                var expected = {
                    RemoveOptionalValuesFromEnum: {
                        sampleBoolean: { type: 'boolean', required: false },
                        sampleEnum: {
                            raw: 'sampleEnum',
                            required: false,
                            type: 'enum',
                            value: [
                                {
                                    value: '"one"',
                                    description: 'test comment',
                                    fullComment: 'test comment',
                                    tags: {}
                                },
                                { value: '"two"', description: '', fullComment: '', tags: {} },
                                { value: '"three"', description: '', fullComment: '', tags: {} }
                            ]
                        },
                        sampleString: { type: 'string', required: false }
                    }
                };
                testUtils_1.checkComponent(result, expected, false);
            });
            it('removes undefined from unions', function () {
                var result = parser.parse(testUtils_1.fixturePath('RemoveOptionalValuesFromUnion'));
                var expected = {
                    RemoveOptionalValuesFromUnion: {
                        sampleStringUnion: {
                            required: false,
                            raw: '"string1" | "string2"',
                            type: 'enum',
                            value: [{ value: '"string1"' }, { value: '"string2"' }]
                        },
                        sampleNumberUnion: {
                            required: false,
                            raw: '1 | 2 | 3',
                            type: 'enum',
                            value: [{ value: '1' }, { value: '2' }, { value: '3' }]
                        },
                        sampleMixedUnion: {
                            required: false,
                            raw: '"string1" | "string2" | 1 | 2',
                            type: 'enum',
                            value: [
                                { value: '"string1"' },
                                { value: '"string2"' },
                                { value: '1' },
                                { value: '2' }
                            ]
                        }
                    }
                };
                testUtils_1.check('RemoveOptionalValuesFromUnion', expected, false, null, options);
            });
        });
    });
    describe('parseWithProgramProvider', function () {
        it('should accept existing ts.Program instance', function () {
            var programProviderInvoked = false;
            // mimic a third party library providing a ts.Program instance.
            var programProvider = function () {
                // need to navigate to root because tests run on compiled tests
                // and tsc does not include json files
                var tsconfigPath = path.join(__dirname, '../../src/__tests__/data/tsconfig.json');
                var basePath = path.dirname(tsconfigPath);
                var _a = ts.readConfigFile(tsconfigPath, function (filename) {
                    return fs.readFileSync(filename, 'utf8');
                }), config = _a.config, error = _a.error;
                chai_1.assert.isUndefined(error);
                var _b = ts.parseJsonConfigFileContent(config, ts.sys, basePath, {}, tsconfigPath), options = _b.options, errors = _b.errors;
                chai_1.assert.lengthOf(errors, 0);
                programProviderInvoked = true;
                return ts.createProgram([testUtils_1.fixturePath('Column')], options);
            };
            var result = parser_1.withDefaultConfig().parseWithProgramProvider([testUtils_1.fixturePath('Column')], programProvider);
            testUtils_1.checkComponent(result, {
                Column: {}
            }, false);
            chai_1.assert.isTrue(programProviderInvoked);
        });
    });
    describe('componentNameResolver', function () {
        it('should override default behavior', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayNameStyledComponent'), {
                componentNameResolver: function (exp, source) {
                    return exp.getName() === 'StyledComponentClass' &&
                        parser_1.getDefaultExportForFile(source);
                }
            })[0];
            chai_1.assert.equal(parsed.displayName, 'StatelessDisplayNameStyledComponent');
        });
        it('should fallback to default behavior without a match', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('StatelessDisplayNameStyledComponent'), {
                componentNameResolver: function () { return false; }
            })[0];
            chai_1.assert.equal(parsed.displayName, 'StatelessDisplayNameStyledComponent');
        });
    });
    describe('methods', function () {
        it('should properly parse methods', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('ColumnWithMethods'))[0];
            var methods = parsed.methods;
            var myCoolMethod = methods[0];
            chai_1.assert.equal(myCoolMethod.description, 'My super cool method');
            chai_1.assert.equal(myCoolMethod.docblock, 'My super cool method\n@param myParam Documentation for parameter 1\n@public\n@returns The answer to the universe' // tslint:disable-line max-line-length
            );
            chai_1.assert.deepEqual(myCoolMethod.modifiers, []);
            chai_1.assert.equal(myCoolMethod.name, 'myCoolMethod');
            chai_1.assert.deepEqual(myCoolMethod.params, [
                {
                    description: 'Documentation for parameter 1',
                    name: 'myParam',
                    type: { name: 'number' }
                },
                {
                    description: null,
                    name: 'mySecondParam?',
                    type: { name: 'string' }
                }
            ]);
            chai_1.assert.deepEqual(myCoolMethod.returns, {
                description: 'The answer to the universe',
                type: 'number'
            });
        });
        it('should properly parse static methods', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('ColumnWithStaticMethods'))[0];
            var methods = parsed.methods;
            chai_1.assert.equal(methods[0].name, 'myStaticMethod');
            chai_1.assert.deepEqual(methods[0].modifiers, ['static']);
        });
        it('should handle method with no information', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('ColumnWithMethods'))[0];
            var methods = parsed.methods;
            chai_1.assert.equal(methods[1].name, 'myBasicMethod');
        });
        it('should handle arrow function', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('ColumnWithMethods'))[0];
            var methods = parsed.methods;
            chai_1.assert.equal(methods[2].name, 'myArrowFunction');
        });
        it('should not parse functions not marked with @public', function () {
            var parsed = parser_1.parse(testUtils_1.fixturePath('ColumnWithMethods'))[0];
            var methods = parsed.methods;
            chai_1.assert.equal(Boolean(methods.find(function (method) { return method.name === 'myPrivateFunction'; })), false);
        });
    });
    describe('getDefaultExportForFile', function () {
        it('should filter out forbidden symbols', function () {
            var result = parser_1.getDefaultExportForFile({
                fileName: 'a-b'
            });
            chai_1.assert.equal(result, 'ab');
        });
        it('should remove leading non-letters', function () {
            var result = parser_1.getDefaultExportForFile({
                fileName: '---123aba'
            });
            chai_1.assert.equal(result, 'aba');
        });
        it('should preserve numbers in the middle', function () {
            var result = parser_1.getDefaultExportForFile({
                fileName: '1Body2Text3'
            });
            chai_1.assert.equal(result, 'Body2Text3');
        });
        it('should not return empty string', function () {
            var result = parser_1.getDefaultExportForFile({
                fileName: '---123'
            });
            chai_1.assert.equal(result.length > 0, true);
        });
    });
    describe('issues tests', function () {
        it('188', function () {
            testUtils_1.check('Issue188', {
                Header: {
                    content: { type: 'string', required: true, description: '' }
                }
            }, true, '');
        });
        it('should return prop types for custom component type', function () {
            testUtils_1.check('Issue320', {
                Issue320: {
                    color: {
                        type: 'string',
                        required: false,
                        description: ''
                    },
                    text: { type: 'string', required: true, description: '' }
                }
            }, true, null, {
                customComponentTypes: ['OverridableComponent'],
                savePropValueAsString: true
            });
        });
        it('should parse imported default props for class component', function () {
            testUtils_1.check('ComponentWithImportedDefaultProps', {
                ComponentWithImportedDefaultProps: {
                    name: {
                        type: 'string',
                        defaultValue: 'Node',
                        required: false,
                        description: ''
                    }
                }
            }, false, '');
        });
        it('should handle when parameters are assigned to default exports (subcomponents)', function () {
            testUtils_1.check('SubComponent', {
                Root: {
                    name: {
                        type: 'string',
                        defaultValue: undefined,
                        required: true,
                        description: ''
                    }
                },
                Sub: {
                    name: {
                        type: 'string',
                        defaultValue: undefined,
                        required: true,
                        description: ''
                    }
                }
            }, false, '');
        });
    });
});
//# sourceMappingURL=parser.js.map