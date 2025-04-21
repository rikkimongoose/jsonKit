const WildcardChars = {
    ASTER: '*',
    QUEST: '?'
}

function wildcardsDynamic(str, pattern) {
    const strLength = str.length;
    const wildcardsFilterLength = pattern.length;

    // lookup table for storing results of subproblems
    const lookup = new Array(strLength + 1);
    for (let i = 0; i <= strLength; i++) {
        lookup[i] = new Array(wildcardsFilterLength + 1).fill(false);
    }

    // empty pattern can match with empty string
    lookup[0][0] = true;

    // Only '*' can match with empty string
    for (let j = 1; j <= wildcardsFilterLength; j++) {
        if (pattern[j - 1] === WildcardChars.ASTER) {
            lookup[0][j] = lookup[0][j - 1];
        }
    }

    // fill the table in bottom-up fashion
    for (let i = 1; i <= strLength; i++) {
        for (let j = 1; j <= wildcardsFilterLength; j++) {
            // Two cases if we see a '*'
            // a) We ignore '*' character and move to next character in the pattern,
            //     i.e., '*' indicates an empty sequence.
            // b) '*' character matches with its character in input
            if (pattern[j - 1] === WildcardChars.ASTER) {
                lookup[i][j] = lookup[i][j - 1] || lookup[i - 1][j];
            }
            // Current characters are considered as matching in two cases
            // (a) current character of pattern is '?'
            // (b) characters actually match
            else if (pattern[j - 1] === WildcardChars.QUEST || str[i - 1] === pattern[j - 1]) {
                lookup[i][j] = lookup[i - 1][j - 1];
            }
            // If characters don't match
            else {
                lookup[i][j] = false;
            }
        }
    }
    return lookup[strLength][wildcardsFilterLength];
}

function equalsByWildcardsRecursive(str, sIndex, sLen, pattern, pIndex, pLen) {
    // Base case.
    if (sIndex >= sLen && pIndex >= pLen) return true;
    else if (sIndex >= sLen) {
        // Check whether the remaining part of p all "*".
        while (pIndex < pLen) {
            if (pattern[pIndex] !== WildcardChars.ASTER) return false;
            pIndex++;
        }
        return true;
    } else if (pIndex >= pLen) {
        return false;
    }

    const sc = str[sIndex];
    const pc = pattern[pIndex];

    if (pc === WildcardChars.QUEST || pc === sc) {
        return equalsByWildcardsRecursive(str, sIndex + 1, sLen, pattern, pIndex + 1, pLen);
    } else if (pc === WildcardChars.ASTER) {
        return equalsByWildcardsRecursive(str, sIndex, sLen, pattern, pIndex + 1, pLen) ||
               equalsByWildcardsRecursive(str, sIndex + 1, sLen, pattern, pIndex, pLen);
    } else {
        return false;
    }
}

function wildcardsRecursive(str, pattern) {
    return equalsByWildcardsRecursive(str, 0, str.length, pattern, 0, pattern.length);
}