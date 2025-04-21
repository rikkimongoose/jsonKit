const cachedWildcards = {};

const ComparatorFactory = {
    generateComparator: function(filterStr) {
        const normFilterStr = norm(filterStr);
        const operators = ['!', '|', '&'];
        if(!operators.some(op => normFilterStr.includes(op))) {
            return {
                matches: (str) => norm(str).includes(normFilterStr)
            };
        }

        const ast = generateAST(filterStr);
        const wildcards = ["?", "*"];
        return {
            ast,
            matches: function(str) {
                executorFunc = (token) => {
                    if(!wildcards.some(op => token.includes(op))) {
                        return norm(str).includes(token);
                    }
                    let checkWcMatch = _.get(cachedWildcards, token, null);
                    if (!isMatch) {
                        checkWcMatch = wcmatch(token);
                        cachedWildcards[token] = checkWcMatch;
                    }
                    return checkWcMatch(norm(str))
                }
                return evaluate(this.ast, executorFunc);
            }
        }
    }
}