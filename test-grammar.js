export default {
  mode: 'sexp',

  grammar: {
    Expression: [
      ['NUMBER', '1'],
      ['Expression + Expression', '["+", 1, 3]'],
      ['Expression * Expression', '["*", 1, 3]']
    ]
  },

  operators: [
    ['left', '+'],
    ['left', '*']
  ]
};
