import { type CryptoMetadata } from './always-encrypted/types';
import { type InternalConnectionOptions } from './connection';
import { Collation } from './collation';
export interface Parameter {
    type: DataType;
    name: string;
    value: unknown;
    output: boolean;
    length?: number | undefined;
    precision?: number | undefined;
    scale?: number | undefined;
    nullable?: boolean | undefined;
    forceEncrypt?: boolean | undefined;
    cryptoMetadata?: CryptoMetadata | undefined;
    encryptedVal?: Buffer | undefined;
}
export interface ParameterData<T = any> {
    length?: number | undefined;
    scale?: number | undefined;
    precision?: number | undefined;
    collation?: Collation | undefined;
    value: T;
}
export interface DataType {
    id: number;
    type: string;
    name: string;
    declaration(parameter: Parameter): string;
    generateTypeInfo(parameter: ParameterData, options: InternalConnectionOptions): Buffer;
    generateParameterLength(parameter: ParameterData, options: InternalConnectionOptions): Buffer;
    generateParameterData(parameter: ParameterData, options: InternalConnectionOptions): Generator<Buffer, void>;
    validate(value: any, collation: Collation | undefined, options?: InternalConnectionOptions): any;
    hasTableName?: boolean;
    resolveLength?: (parameter: Parameter) => number;
    resolvePrecision?: (parameter: Parameter) => number;
    resolveScale?: (parameter: Parameter) => number;
}
export declare const TYPE: {
    [x: number]: DataType;
};
/**
 * <table>
 * <thead>
 *   <tr>
 *     <th>Type</th>
 *     <th>Constant</th>
 *     <th>JavaScript</th>
 *     <th>Result set</th>
 *     <th>Parameter</th>
 *   </tr>
 * </thead>
 *
 * <tbody>
 *   <tr class="group-heading">
 *     <th colspan="5">Exact numerics</th>
 *   </tr>
 *   <tr>
 *     <td><code>bit</code></td>
 *     <td><code>[[TYPES.Bit]]</code></td>
 *     <td><code>boolean</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>tinyint</code></td>
 *     <td><code>[[TYPES.TinyInt]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>smallint</code></td>
 *     <td><code>[[TYPES.SmallInt]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>int</code></td>
 *     <td><code>[[TYPES.Int]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>bigint</code><sup>1</sup></td>
 *     <td><code>[[TYPES.BigInt]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>numeric</code><sup>2</sup></td>
 *     <td><code>[[TYPES.Numeric]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>decimal</code><sup>2</sup></td>
 *     <td><code>[[TYPES.Decimal]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>smallmoney</code></td>
 *     <td><code>[[TYPES.SmallMoney]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>money</code></td>
 *     <td><code>[[TYPES.Money]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 * </tbody>
 *
 * <tbody>
 *   <tr class="group-heading">
 *     <th colspan="5">Approximate numerics</th>
 *   </tr>
 *   <tr>
 *     <td><code>float</code></td>
 *     <td><code>[[TYPES.Float]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>real</code></td>
 *     <td><code>[[TYPES.Real]]</code></td>
 *     <td><code>number</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 * </tbody>
 *
 * <tbody>
 *   <tr class="group-heading">
 *     <th colspan="4">Date and Time</th>
 *   </tr>
 *   <tr>
 *     <td><code>smalldatetime</code></td>
 *     <td><code>[[TYPES.SmallDateTime]]</code></td>
 *     <td><code>Date</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>datetime</code></td>
 *     <td><code>[[TYPES.DateTime]]</code></td>
 *     <td><code>Date</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>datetime2</code></td>
 *     <td><code>[[TYPES.DateTime2]]</code></td>
 *     <td><code>Date</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>datetimeoffset</code></td>
 *     <td><code>[[TYPES.DateTimeOffset]]</code></td>
 *     <td><code>Date</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>time</code></td>
 *     <td><code>[[TYPES.Time]]</code></td>
 *     <td><code>Date</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>date</code></td>
 *     <td><code>[[TYPES.Date]]</code></td>
 *     <td><code>Date</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 * </tbody>
 *
 * <tbody>
 *   <tr class="group-heading">
 *     <th colspan="4">Character Strings</th>
 *   </tr>
 *   <tr>
 *     <td><code>char</code></td>
 *     <td><code>[[TYPES.Char]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>varchar</code><sup>3</sup></td>
 *     <td><code>[[TYPES.VarChar]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>text</code></td>
 *     <td><code>[[TYPES.Text]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 * </tbody>
 *
 * <tbody>
 *   <tr class="group-heading">
 *     <th colspan="4">Unicode Strings</th>
 *   </tr>
 *   <tr>
 *     <td><code>nchar</code></td>
 *     <td><code>[[TYPES.NChar]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>nvarchar</code><sup>3</sup></td>
 *     <td><code>[[TYPES.NVarChar]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>ntext</code></td>
 *     <td><code>[[TYPES.NText]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>-</td>
 *   </tr>
 * </tbody>
 *
 * <tbody>
 *   <tr class="group-heading">
 *     <th colspan="5">Binary Strings<sup>4</sup></th>
 *   </tr>
 *   <tr>
 *     <td><code>binary</code></td>
 *     <td><code>[[TYPES.Binary]]</code></td>
 *     <td><code>Buffer</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>varbinary</code></td>
 *     <td><code>[[TYPES.VarBinary]]</code></td>
 *     <td><code>Buffer</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>image</code></td>
 *     <td><code>[[TYPES.Image]]</code></td>
 *     <td><code>Buffer</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 * </tbody>
 *
 * <tbody>
 *   <tr class="group-heading">
 *     <th colspan="5">Other Data Types</th>
 *   </tr>
 *   <tr>
 *     <td><code>TVP</code></td>
 *     <td><code>[[TYPES.TVP]]</code></td>
 *     <td><code>Object</code></td>
 *     <td>-</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>UDT</code></td>
 *     <td><code>[[TYPES.UDT]]</code></td>
 *     <td><code>Buffer</code></td>
 *     <td>✓</td>
 *     <td>-</td>
 *   </tr>
 *   <tr>
 *     <td><code>uniqueidentifier</code><sup>4</sup></td>
 *     <td><code>[[TYPES.UniqueIdentifier]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>✓</td>
 *   </tr>
 *   <tr>
 *     <td><code>variant</code></td>
 *     <td><code>[[TYPES.Variant]]</code></td>
 *     <td><code>any</code></td>
 *     <td>✓</td>
 *     <td>-</td>
 *   </tr>
 *   <tr>
 *     <td><code>xml</code></td>
 *     <td><code>[[TYPES.Xml]]</code></td>
 *     <td><code>string</code></td>
 *     <td>✓</td>
 *     <td>-</td>
 *   </tr>
 * </tbody>
 * </table>
 *
 * <ol>
 *   <li>
 *     <h4>BigInt</h4>
 *     <p>
 *       Values are returned as a string. This is because values can exceed 53 bits of significant data, which is greater than a
 *       Javascript <code>number</code> type can represent as an integer.
 *     </p>
 *   </li>
 *   <li>
 *     <h4>Numerical, Decimal</h4>
 *     <p>
 *       For input parameters, default precision is 18 and default scale is 0. Maximum supported precision is 19.
 *     </p>
 *   </li>
 *   <li>
 *     <h4>VarChar, NVarChar</h4>
 *     <p>
 *       <code>varchar(max)</code> and <code>nvarchar(max)</code> are also supported.
 *     </p>
 *   </li>
 *   <li>
 *     <h4>UniqueIdentifier</h4>
 *     <p>
 *       Values are returned as a 16 byte hexadecimal string.
 *     </p>
 *     <p>
 *       Note that the order of bytes is not the same as the character representation. See
 *       <a href="http://msdn.microsoft.com/en-us/library/ms190215.aspx">Using uniqueidentifier Data</a>
 *       for an example of the different ordering of bytes.
 *     </p>
 *   </li>
 * </ol>
 */
export declare const TYPES: {
    TinyInt: DataType;
    Bit: DataType;
    SmallInt: DataType;
    Int: DataType;
    SmallDateTime: DataType;
    Real: DataType;
    Money: DataType;
    DateTime: DataType;
    Float: DataType;
    Decimal: DataType & {
        resolvePrecision: NonNullable<DataType["resolvePrecision"]>;
        resolveScale: NonNullable<DataType["resolveScale"]>;
    };
    Numeric: DataType & {
        resolveScale: NonNullable<DataType["resolveScale"]>;
        resolvePrecision: NonNullable<DataType["resolvePrecision"]>;
    };
    SmallMoney: DataType;
    BigInt: DataType;
    Image: DataType;
    Text: DataType;
    UniqueIdentifier: DataType;
    NText: DataType;
    VarBinary: {
        maximumLength: number;
    } & DataType;
    VarChar: {
        maximumLength: number;
    } & DataType;
    Binary: {
        maximumLength: number;
    } & DataType;
    Char: {
        maximumLength: number;
    } & DataType;
    NVarChar: {
        maximumLength: number;
    } & DataType;
    NChar: DataType & {
        maximumLength: number;
    };
    Xml: DataType;
    Time: DataType;
    Date: DataType;
    DateTime2: DataType & {
        resolveScale: NonNullable<DataType["resolveScale"]>;
    };
    DateTimeOffset: DataType & {
        resolveScale: NonNullable<DataType["resolveScale"]>;
    };
    UDT: DataType;
    TVP: DataType;
    Variant: DataType;
};
export declare const typeByName: {
    TinyInt: DataType;
    Bit: DataType;
    SmallInt: DataType;
    Int: DataType;
    SmallDateTime: DataType;
    Real: DataType;
    Money: DataType;
    DateTime: DataType;
    Float: DataType;
    Decimal: DataType & {
        resolvePrecision: NonNullable<DataType["resolvePrecision"]>;
        resolveScale: NonNullable<DataType["resolveScale"]>;
    };
    Numeric: DataType & {
        resolveScale: NonNullable<DataType["resolveScale"]>;
        resolvePrecision: NonNullable<DataType["resolvePrecision"]>;
    };
    SmallMoney: DataType;
    BigInt: DataType;
    Image: DataType;
    Text: DataType;
    UniqueIdentifier: DataType;
    NText: DataType;
    VarBinary: {
        maximumLength: number;
    } & DataType;
    VarChar: {
        maximumLength: number;
    } & DataType;
    Binary: {
        maximumLength: number;
    } & DataType;
    Char: {
        maximumLength: number;
    } & DataType;
    NVarChar: {
        maximumLength: number;
    } & DataType;
    NChar: DataType & {
        maximumLength: number;
    };
    Xml: DataType;
    Time: DataType;
    Date: DataType;
    DateTime2: DataType & {
        resolveScale: NonNullable<DataType["resolveScale"]>;
    };
    DateTimeOffset: DataType & {
        resolveScale: NonNullable<DataType["resolveScale"]>;
    };
    UDT: DataType;
    TVP: DataType;
    Variant: DataType;
};
