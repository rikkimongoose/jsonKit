// Парсер, реализующий разбор логических выражений с поддержкой неограниченного числа операндов
// и литералов в виде неquoted-слов или строк с пробелами в кавычках.
// Грамматика:
//
// Expression    -> OrExpression
// OrExpression  -> AndExpression ( '|' AndExpression )*
// AndExpression -> NotExpression ( '&' NotExpression )*
// NotExpression -> '!' NotExpression | Primary
// Primary       -> '(' Expression ')' | literal
//
class ExpressionParser {
    constructor(input) {
      this.input = input;
      this.tokens = [];
      this.current = 0;
    }
  
    // Функция tokenize разбивает строку исходного выражения на токены.
    // Она распознает:
    //   - Литералы в кавычках: " ... " с возможностями экранировать символы (например, \")
    //   - Операторы и скобки: ( ) & | !
    //   - Unquoted литералы: последовательности символов без пробелов и управляющих символов
    tokenize() {
      // Объяснение шаблона:
      // \s*                         — пропускаем пробельные символы
      // (?:"((?:[^"\\]|\\.)*)"       — либо группа: строка в двойных кавычках, где (?:[^"\\]|\\.) повторяет
      //                                любой символ, кроме кавычки или обратного слэша, либо экранированный символ.
      // | ([()&|!])                 — либо оператор или скобка
      // | ([^"\s()&|!]+))           — либо unquoted литерал (любой символ, кроме кавычек, пробельных символов и операторов)
      // \s*                         — пропускаем пробельные символы
      const regex = /\s*(?:"((?:[^"\\]|\\.)*)"|([()&|!])|([^"\s()&|!]+))\s*/g;
      let match;
      while ((match = regex.exec(this.input)) !== null) {
        if (match[1] !== undefined) {
          // Это литерал в кавычках. Необходимо убрать кавычки и заменить экранированные символы.
          const unescaped = match[1].replace(/\\(.)/g, "$1");
          this.tokens.push(unescaped);
        } else if (match[2] !== undefined) {
          // Это оператор или скобка.
          this.tokens.push(match[2]);
        } else if (match[3] !== undefined) {
          // Это unquoted литерал.
          this.tokens.push(match[3]);
        }
      }
    }
  
    // Основной метод парсинга. Проверяет, что после разбора не осталось лишних токенов.
    parse() {
      this.tokenize();
      const result = this.parseExpression();
      if (this.current < this.tokens.length) {
        throw new SyntaxError(
          `Непредвиденный токен "${this.tokens[this.current]}" в позиции ${this.current}`
        );
      }
      return result;
    }
  
    // Начинаем с разбора уровня OrExpression.
    parseExpression() {
      return this.parseOr();
    }
  
    // Разбор выражения с оператором OR ('|').
    // Собираем все операнды, разделённые '|', в один узел с полем operands.
    parseOr() {
      let operands = [this.parseAnd()];
      while (this.peek() === '|') {
        this.next(); // потребляем '|'
        operands.push(this.parseAnd());
      }
      return operands.length === 1 ? operands[0] : { operator: '|', operands };
    }
  
    // Разбор выражения с оператором AND ('&').
    parseAnd() {
      let operands = [this.parseNot()];
      while (this.peek() === '&') {
        this.next(); // потребляем '&'
        operands.push(this.parseNot());
      }
      return operands.length === 1 ? operands[0] : { operator: '&', operands };
    }
  
    // Разбор унарного оператора NOT ('!').
    parseNot() {
      if (this.peek() === '!') {
        this.next(); // потребляем '!'
        const operand = this.parseNot();
        return { operator: '!', operand };
      }
      return this.parsePrimary();
    }
  
    // Разбор первичного элемента: либо выражение в скобках, либо литерал.
    parsePrimary() {
      const token = this.peek();
      if (token === '(') {
        this.next(); // потребляем '('
        const expr = this.parseExpression();
        if (this.peek() !== ')') {
          throw new SyntaxError("Ожидалась закрывающая скобка ')'");
        }
        this.next(); // потребляем ')'
        return expr;
      }
      // Литерал: может быть как unquoted, так и строка из кавычек (уже обработанная в tokenize)
      return { value: this.next() };
    }
  
    // Возвращает текущий токен без смещения указателя.
    peek() {
      return this.tokens[this.current];
    }
  
    // Возвращает текущий токен и сдвигает указатель.
    next() {
      return this.tokens[this.current++];
    }
  }
  
  // Функция evaluate вычисляет логическое значение выражения (AST).
  // В качестве второго аргумента передаётся объект executor, которые и проверяет, какое значение у элемента.
  function evaluate(ast, executor) {
    if (ast.hasOwnProperty('value')) {
      // Если значение не задано в контексте, считаем его false.
      return executor(ast.value);
    }
  
    if (ast.operator) {
      switch (ast.operator) {
        case '!':
          return !evaluate(ast.operand, executor);
        case '&':
          if (!Array.isArray(ast.operands)) {
            throw new Error("Ожидается массив операндов для оператора '&'");
          }
          return ast.operands.every(op => evaluate(op, executor));
        case '|':
          if (!Array.isArray(ast.operands)) {
            throw new Error("Ожидается массив операндов для оператора '|'");
          }
          return ast.operands.some(op => evaluate(op, executor));
        default:
          throw new Error("Неизвестный оператор: " + ast.operator);
      }
    }
    throw new Error("Некорректный AST узел");
  }
  
function generateAST(filterStr) {
  const parser = new ExpressionParser(norm(input));
  return parser.parse();
}
 
  // --- Пример использования --- //
  
  // Пример строки с разными типами литералов:
  // A - unquoted литерал (слово без пробелов)
  // "B C" - строка с пробелами в кавычках (экранирование кавычек тоже поддерживается)
  // !("Nested \"Quote\"" | D) - пример с экранированными кавычками внутри
  /*const input = 'A & ("B C" | !("Nested \\"Quote\\"" | D))';
  
  try {
    const parser = new ExpressionParser(input);
    const ast = parser.parse();
  
    console.log("Полученное дерево выражений (AST):");
    console.log(JSON.stringify(ast, null, 2));
  
    // Задаем контекст: здесь каждому литералу сопоставляются булевы значения.
    const context = {
      A: true,
      "B C": false,
      "Nested \"Quote\"": true,
      D: false
    };
  
    const result = evaluate(ast, context);
    console.log(`Результат выражения "${input}" при заданном контексте:`, result);
  } catch (e) {
    console.error("Ошибка парсинга:", e.message);
  }*/