const cachedWildcards = {};

const ComparatorFactory = {
    generateComparator: function(filterStr) {
        const normFilterStr = norm(filterStr);
        const operators = ['!', '|', '&'];
        const wildcards = ["?", "*"];
        const toWcFilter = (source) => `*${source}*`
        if(!operators.some(op => normFilterStr.includes(op))) {
            return {
                matches: (str) => {
                    if(!wildcards.some(op => normFilterStr.includes(op))) {
                        return norm(str).includes(normFilterStr);
                    }
                    return wildcardsRecursive(str, toWcFilter(normFilterStr));
                }
            };
        }
        const ast = generateAST(normFilterStr);
        return {
            ast,
            matches: function(str) {
                executorFunc = (token) => {
                    if(!wildcards.some(op => token.includes(op))) {
                        return norm(str).includes(token);
                    }
                    return wildcardsRecursive(str, toWcFilter(token));
                }
                return evaluate(this.ast, executorFunc);
            }
        }
    }
}