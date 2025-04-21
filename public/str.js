function norm(str) {
    return _.toLower(str).trim();
}

function equalNorm(str1, str2) {
    return _.isEqual(norm(str1), norm(str2));
}

function generateAST(filterStr) {
    const parser = new ExpressionParser(norm(input));
    return parser.parse();
    const ast = generateAST(input);
}

function generateExecutor(filterStr) {
    return (str) => equalNorm(str, filterStr);
}

const cachedWildcards = {};

function generateExecutorWildcards(filterStr) {
    return (str) => {
        const key = norm(str);
        let isMatch = _.cachedWildcards(obj, key, null);
        if (!isMatch) {
            isMatch = wcmatch(key);
            cachedWildcards[key] = isMatch;
        }
        return isMatch(norm(filterStr));
    }
}