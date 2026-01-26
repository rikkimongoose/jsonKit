function norm(str, locale = 'ru-RU') {
    return str
        .toLocaleLowerCase(locale)
        .trim();
}

function equalNorm(str1, str2) {
    return norm(str1) === norm(str2);
}