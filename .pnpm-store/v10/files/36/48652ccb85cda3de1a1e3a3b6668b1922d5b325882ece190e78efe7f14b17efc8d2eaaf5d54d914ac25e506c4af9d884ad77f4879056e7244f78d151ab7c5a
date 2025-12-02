function isResolverClass(resolver) {
    return typeof resolver === 'object';
}
export default function runResolver(resolver, file) {
    return isResolverClass(resolver) ? resolver.resolve(file) : resolver(file);
}
