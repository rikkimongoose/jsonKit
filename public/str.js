function norm(str) {
    return _.toLower(str).trim();
}

function equalNorm(str1, str2) {
    return _.isEqual(norm(str1), norm(str2));
}