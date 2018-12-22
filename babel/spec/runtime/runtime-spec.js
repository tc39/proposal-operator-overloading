const runtime = require("../../build/runtime.js");

describe("A suite", () => {
  it('normal operators work without overloading', () => {
    const operators = runtime._declareOperators();
    expect(runtime._additionOperator(1, 2, operators)).toBe(3);
  });
});
