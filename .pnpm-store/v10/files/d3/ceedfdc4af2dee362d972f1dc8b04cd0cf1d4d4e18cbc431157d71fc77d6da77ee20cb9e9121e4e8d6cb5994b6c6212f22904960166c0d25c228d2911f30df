import { Expression } from '../expression/expression.js';
import { ExpressionWrapper } from '../expression/expression-wrapper.js';
import { ReferenceExpression } from '../parser/reference-parser.js';
import { CaseNode } from '../operation-node/case-node.js';
import { ComparisonOperatorExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { ExtractTypeFromValueExpression } from '../parser/value-parser.js';
import { KyselyTypeError } from '../util/type-error.js';
export declare class CaseBuilder<DB, TB extends keyof DB, W = unknown, O = never> implements Whenable<DB, TB, W, O> {
    #private;
    constructor(props: CaseBuilderProps);
    /**
     * Adds a `when` clause to the case statement.
     *
     * A `when` call must be followed by a {@link CaseThenBuilder.then} call.
     */
    when<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: unknown extends W ? RE : KyselyTypeError<'when(lhs, op, rhs) is not supported when using case(value)'>, op: ComparisonOperatorExpression, rhs: VE): CaseThenBuilder<DB, TB, W, O>;
    when(expression: Expression<W>): CaseThenBuilder<DB, TB, W, O>;
    when(value: unknown extends W ? KyselyTypeError<'when(value) is only supported when using case(value)'> : W): CaseThenBuilder<DB, TB, W, O>;
}
interface CaseBuilderProps {
    readonly node: CaseNode;
}
export declare class CaseThenBuilder<DB, TB extends keyof DB, W, O> {
    #private;
    constructor(props: CaseBuilderProps);
    /**
     * Adds a `then` clause to the `case` statement.
     *
     * A `then` call can be followed by {@link Whenable.when}, {@link CaseWhenBuilder.else},
     * {@link CaseWhenBuilder.end} or {@link CaseWhenBuilder.endCase} call.
     */
    then<E extends Expression<unknown>>(expression: E): CaseWhenBuilder<DB, TB, W, O | ExtractTypeFromValueExpression<E>>;
    then<V>(value: V): CaseWhenBuilder<DB, TB, W, O | V>;
}
export declare class CaseWhenBuilder<DB, TB extends keyof DB, W, O> implements Whenable<DB, TB, W, O>, Endable<DB, TB, O | null> {
    #private;
    constructor(props: CaseBuilderProps);
    /**
     * Adds a `when` clause to the case statement.
     *
     * A `when` call must be followed by a {@link CaseThenBuilder.then} call.
     */
    when<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: unknown extends W ? RE : KyselyTypeError<'when(lhs, op, rhs) is not supported when using case(value)'>, op: ComparisonOperatorExpression, rhs: VE): CaseThenBuilder<DB, TB, W, O>;
    when(expression: Expression<W>): CaseThenBuilder<DB, TB, W, O>;
    when(value: unknown extends W ? KyselyTypeError<'when(value) is only supported when using case(value)'> : W): CaseThenBuilder<DB, TB, W, O>;
    /**
     * Adds an `else` clause to the `case` statement.
     *
     * An `else` call must be followed by an {@link Endable.end} or {@link Endable.endCase} call.
     */
    else<E extends Expression<unknown>>(expression: E): CaseEndBuilder<DB, TB, O | ExtractTypeFromValueExpression<E>>;
    else<V>(value: V): CaseEndBuilder<DB, TB, O | V>;
    /**
     * Adds an `end` keyword to the case operator.
     *
     * `case` operators can only be used as part of a query.
     * For a `case` statement used as part of a stored program, use {@link endCase} instead.
     */
    end(): ExpressionWrapper<DB, TB, O | null>;
    /**
     * Adds `end case` keywords to the case statement.
     *
     * `case` statements can only be used for flow control in stored programs.
     * For a `case` operator used as part of a query, use {@link end} instead.
     */
    endCase(): ExpressionWrapper<DB, TB, O | null>;
}
export declare class CaseEndBuilder<DB, TB extends keyof DB, O> implements Endable<DB, TB, O> {
    #private;
    constructor(props: CaseBuilderProps);
    /**
     * Adds an `end` keyword to the case operator.
     *
     * `case` operators can only be used as part of a query.
     * For a `case` statement used as part of a stored program, use {@link endCase} instead.
     */
    end(): ExpressionWrapper<DB, TB, O>;
    /**
     * Adds `end case` keywords to the case statement.
     *
     * `case` statements can only be used for flow control in stored programs.
     * For a `case` operator used as part of a query, use {@link end} instead.
     */
    endCase(): ExpressionWrapper<DB, TB, O>;
}
interface Whenable<DB, TB extends keyof DB, W, O> {
    /**
     * Adds a `when` clause to the case statement.
     *
     * A `when` call must be followed by a {@link CaseThenBuilder.then} call.
     */
    when<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: unknown extends W ? RE : KyselyTypeError<'when(lhs, op, rhs) is not supported when using case(value)'>, op: ComparisonOperatorExpression, rhs: VE): CaseThenBuilder<DB, TB, W, O>;
    when(expression: Expression<W>): CaseThenBuilder<DB, TB, W, O>;
    when(value: unknown extends W ? KyselyTypeError<'when(value) is only supported when using case(value)'> : W): CaseThenBuilder<DB, TB, W, O>;
}
interface Endable<DB, TB extends keyof DB, O> {
    /**
     * Adds an `end` keyword to the case operator.
     *
     * `case` operators can only be used as part of a query.
     * For a `case` statement used as part of a stored program, use {@link endCase} instead.
     */
    end(): ExpressionWrapper<DB, TB, O>;
    /**
     * Adds `end case` keywords to the case statement.
     *
     * `case` statements can only be used for flow control in stored programs.
     * For a `case` operator used as part of a query, use {@link end} instead.
     */
    endCase(): ExpressionWrapper<DB, TB, O>;
}
export {};
