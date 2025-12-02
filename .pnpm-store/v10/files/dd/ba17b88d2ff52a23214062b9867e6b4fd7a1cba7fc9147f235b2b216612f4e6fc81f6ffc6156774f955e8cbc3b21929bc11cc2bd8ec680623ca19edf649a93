const ERROR_TYPES_PATTERN = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;
class StringCoercer {
    match(input) {
        return 'string' == typeof input;
    }
    coerce(input, ctx) {
        const [type, value] = this.getInfos(input);
        return {
            type: type ?? 'Error',
            value: value ?? input,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
    }
    getInfos(candidate) {
        let type = 'Error';
        let value = candidate;
        const groups = candidate.match(ERROR_TYPES_PATTERN);
        if (groups) {
            type = groups[1];
            value = groups[2];
        }
        return [
            type,
            value
        ];
    }
}
export { StringCoercer };
