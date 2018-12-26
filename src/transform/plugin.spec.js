const babel = require("@babel/core");
const shim = require("@littledan/operator-overloading-shim");

const debug = false;

function transform(code) {
  code = babel.transform(code, { plugins: ["./build/plugin.js"] }).code;
  if (debug) console.log(code);
  return code;
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
      val = vec2.contents[2];
    `);
    let val;
    eval(code);
    expect(val).toBe(6);
  });
});

describe("test everything on a full wrapper of Numbers (no interoperation)", () => {
  const Ops = shim.Operators({
  '-'(a, b) { return a.n - b.n; },
  '*'(a, b) { return a.n * b.n; },
  '/'(a, b) { return a.n / b.n; },
  '%'(a, b) { return a.n % b.n; },
  '**'(a, b) { return a.n ** b.n; },
  '&'(a, b) { return a.n & b.n; },
  '^'(a, b) { return a.n ^ b.n; },
  '|'(a, b) { return a.n | b.n; },
  '<<'(a, b) { return a.n << b.n; },
  '>>'(a, b) { return a.n >> b.n; },
  '>>>'(a, b) { return a.n >>> b.n; },
  '=='(a, b) { return a.n == b.n; },
  '+'(a, b) { return a.n + b.n; },
  '<'(a, b) { return a.n < b.n; },
  'pos'(a) { return +a.n; },
  'neg'(a) { return -a.n; },
  '++'(a) { let x = a.n; return new MyNum(++x); },
  '--'(a) { let x = a.n; return new MyNum(--x); },
  '~'(a) { return ~a.n; },
  });

  class MyNum extends Ops {
    constructor(n) { super(); this.n = n; }
  }

  it("works", () => {
    eval(transform(`
      let x = new MyNum(2);
      let y = new MyNum(3);

      expect(() => x+y).toThrowError(TypeError);
      expect(() => x-y).toThrowError(TypeError);

      withOperatorsFrom(MyNum);

      expect(x+y).toBe(5);
      expect(x-y).toBe(-1);
      expect(x*y).toBe(6);
      expect(x/y).toBe(2/3);
      expect(x%y).toBe(2);
      expect(x**y).toBe(8);
      expect(x&y).toBe(2);
      expect(x^y).toBe(1);
      expect(x|y).toBe(3);
      expect(x<<y).toBe(16);
      expect(x>>y).toBe(0);
      expect(x>>>y).toBe(0);
      expect(x==y).toBe(false);
      expect(x<y).toBe(true);
      expect(x>y).toBe(false);
      expect(x>y).toBe(false);
      expect(+x).toBe(2);
      expect(-x).toBe(-2);
      expect(~x).toBe(-3);
      expect((x++).n).toBe(2);
      expect(x.n).toBe(3);
      expect((x--).n).toBe(3);
      expect(x.n).toBe(2);
      expect((++x).n).toBe(3);
      expect(x.n).toBe(3);
      expect((--x).n).toBe(2);
      expect(x.n).toBe(2);
    `));
  });
});

describe("nested scopes", () => {
  const OpsA = shim.Operators({
    'pos'(a) { return 1; },
    open: ["+"]
  });
  const a = new OpsA;

  const OpsB = shim.Operators({
    'pos'(b) { return 2; }
  }, { left: OpsA,
    '+'(a, b) { return 3; }
  });
  const b = new OpsB;

  it("throws appropriate errors in straight line code", () => {
    eval(transform(`
      expect(() => +a).toThrowError(TypeError);
      expect(() => +b).toThrowError(TypeError);
      expect(() => a+b).toThrowError(TypeError);

      withOperatorsFrom(OpsA);

      expect(+a).toBe(1);
      expect(() => +b).toThrowError(TypeError);
      expect(() => a+b).toThrowError(TypeError);

      withOperatorsFrom(OpsB);

      expect(+a).toBe(1);
      expect(+b).toBe(2);
      expect(a+b).toBe(3);
    `));

    eval(transform(`
      expect(() => +a).toThrowError(TypeError);
      expect(() => +b).toThrowError(TypeError);
      expect(() => a+b).toThrowError(TypeError);

      withOperatorsFrom(OpsB);

      expect(() => +a).toThrowError(TypeError);
      expect(+b).toBe(2);
      expect(() => a+b).toThrowError(TypeError);

      withOperatorsFrom(OpsA);

      expect(+a).toBe(1);
      expect(+b).toBe(2);
      expect(a+b).toBe(3);
    `));

    eval(transform(`
      expect(() => +a).toThrowError(TypeError);
      expect(() => +b).toThrowError(TypeError);
      expect(() => a+b).toThrowError(TypeError);

      withOperatorsFrom(OpsA, OpsB);

      expect(+a).toBe(1);
      expect(+b).toBe(2);
      expect(a+b).toBe(3);
    `));
  });

  it("throws appropriate errors in nested code", () => {
    eval(transform(`
      expect(() => +a).toThrowError(TypeError);
      expect(() => +b).toThrowError(TypeError);
      expect(() => a+b).toThrowError(TypeError);

      withOperatorsFrom(OpsA);

      {
        expect(+a).toBe(1);
        expect(() => +b).toThrowError(TypeError);
        expect(() => a+b).toThrowError(TypeError);

        withOperatorsFrom(OpsB);

        expect(+a).toBe(1);
        expect(+b).toBe(2);
        expect(a+b).toBe(3);
      }

      expect(+a).toBe(1);
      expect(() => +b).toThrowError(TypeError);
      expect(() => a+b).toThrowError(TypeError);
    `));
  });

});
