// ==============================================================================
// Simple Calculator Grammar - Solar Parser Example
// ==============================================================================
//
// This grammar demonstrates Solar's s-expression mode with a basic calculator
// that handles numbers, parentheses, and the four basic arithmetic operators.
//
// Generate parser:
//   solar calculator.js -o calculator-parser.js
//
// Test grammar info:
//   solar --info calculator.js
//
// Example input:  2 + 3 * 4
// Example output: ["+", "2", ["*", "3", "4"]]

export default {
  // Use s-expression mode for clean array output
  mode: 'sexp',

  // Grammar rules
  grammar: {
    // Program is one or more expressions
    Program: [
      ['Expression', '1']
    ],

    // Expressions: numbers, operations, and parentheses
    Expression: [
      ['NUMBER', '1'],                              // Just return the number
      ['Expression + Expression', '["+", 1, 3]'],   // Addition
      ['Expression - Expression', '["-", 1, 3]'],   // Subtraction
      ['Expression * Expression', '["*", 1, 3]'],   // Multiplication
      ['Expression / Expression', '["/", 1, 3]'],   // Division
      ['( Expression )', '2'],                      // Parentheses (return inner)
      ['- Expression', '["-", 2]', { prec: 'UMINUS' }]  // Unary minus
    ]
  },

  // Operator precedence (lowest to highest)
  operators: [
    ['left', '+', '-'],      // Addition and subtraction (lowest)
    ['left', '*', '/'],      // Multiplication and division
    ['right', 'UMINUS']      // Unary minus (highest)
  ]
};

// ==============================================================================
// Usage Example
// ==============================================================================
//
// After generating the parser, use it like this:
//
// import { Parser } from './calculator-parser.js';
// 
// // You'll need a lexer that tokenizes: NUMBER, +, -, *, /, (, )
// const parser = new Parser();
// parser.lexer = myLexer;
// 
// const result = parser.parse('2 + 3 * 4');
// // Result: ["+", "2", ["*", "3", "4"]]
//
// The s-expression clearly shows the parse tree with correct precedence!

