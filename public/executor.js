const cachedWildcards = {};

const ComparatorFactory = {
    generateComparator: function(filterStr) {
        const normFilterStr = norm(filterStr);
        const operators = ['!', '|', '&'];
        //const wildcards = ["?", "*"];
        const toWcFilter = (source) => `*${source}*`
        if(!operators.some(op => normFilterStr.includes(op))) {
            return {
                matches: (str) => {
                    //if(!wildcards.some(op => normFilterStr.includes(op))) {
                        return norm(str).includes(normFilterStr);
                    /*}
                    const wcFilter = toWcFilter(normFilterStr);
                    let checkWcMatch = _.get(cachedWildcards, wcFilter, null);
                    if (!checkWcMatch) {
                        checkWcMatch = wcmatch(wcFilter);
                        cachedWildcards[wcFilter] = checkWcMatch;
                    }
                    return checkWcMatch(norm(str))*/
                }
            };
        }

        const ast = generateAST(filterStr);
        return {
            ast,
            matches: function(str) {
                executorFunc = (token) => {
                    //if(!wildcards.some(op => token.includes(op))) {
                        return norm(str).includes(token);
                    /*}
                    const wcFilter = toWcFilter(token);
                    let checkWcMatch = _.get(cachedWildcards, wcFilter, null);
                    if (!checkWcMatch) {
                        checkWcMatch = wcmatch(wcFilter);
                        cachedWildcards[wcFilter] = checkWcMatch;
                    }
                    return checkWcMatch(norm(str))*/
                }
                return evaluate(this.ast, executorFunc);
            }
        }
    }
}