const babel = require("@babel/core");
const shim = require("@littledan/operator-overloading-shim");

function transform(code) {
  return babel.transform(code, { plugins: ["./build/plugin.js"] });
}

describe("overloading + works", () => {
  const Ops = shim.Operators({
    '+'(a, b) {
      return new Vector(a.contents.map((elt, i) => elt + b.contents[i]));
    }
  });

  class Vector extends Ops {
    constructor(contents) { super(); this.contents = contents; }
  }

  it("simply works", () => {
    const code = transform(`
      withOperatorsFrom(Vector);
      const vec = new Vector([1, 2, 3]);
      const vec2 = vec + vec;
      val = vec2.contents[0];
    `);
    let val;
    eval(code);
    expect(val).toBe(6);
  }); 
});
