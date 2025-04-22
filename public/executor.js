const ComparatorFactory = {
    generateComparator: function(filterStr) {
        const normFilterStr = norm(filterStr);
        const operators = ['!', '|', '&'];
        const wildcards = ["?", "*"];
        const addAsterisks = (str) => {
            if (str === '') {
              return str;
            }
            
            let result = str;
            
            // Проверяем первый символ
            if (result[0] !== '*') {
              result = '*' + result;
            }
            
            // Проверяем последний символ
            if (result[result.length - 1] !== '*') {
              result = result + '*';
            }
            
            return result;
        }
        
        if(!operators.some(op => normFilterStr.includes(op))) {
            return {
                matches: (str) => {
                    if(!wildcards.some(op => normFilterStr.includes(op))) {
                        return norm(str).includes(normFilterStr);
                    }
                    return wildcardsRecursive(str, addAsterisks(normFilterStr));
                }
            };
        }
        const ast = generateAST(normFilterStr);
        return {
            ast,
            matches: function(str) {
                const executorFunc = (token) => {
                    if(!wildcards.some(op => token.includes(op))) {
                        return norm(str).includes(token);
                    }
                    return wildcardsRecursive(str, addAsterisks(token));
                }
                return evaluate(this.ast, executorFunc);
            }
        }
    }
}