# Operator overloading in JavaScript

Should JavaScript support operator overloading? It's not clear one way or another whether operator overloading has enough benefit in terms of the complexity, in terms of language design, implementation work, and security surface. At the same time, there's an argument that it's better to provide general operator overloading than to overload operators for specific, additional, built-in constructs (and partly for this reason, Decimal was not added as part of ES6, although it might have been useful for JS developers).

This article tries to examine how operator overloading *could* look, if we want to go in this direction. Hopefully, the concreteness will help us decide whether to go down this path, which can help move the committee towards concrete next steps on long-standing feature requests, one way or another.

(Status: Not at a stage; not presented in TC39)

## Case studies

Operator overloading is all about enabling richer libraries. This section gives four motivating use cases of such rich libraries.

### Numeric types

JavaScript has a very restricted set of numeric types. Traditionally, it had just Number: an IEEE-754 double-precision binary float. The [BigInt proposal](http://github.com/tc39/proposal-bigint/) (shipping in Chrome) added a single new numeric type for arbitrary-size integers. But there are more numeric types that developers need in practice, such as decimals, rationals, complex numbers, etc. Operator overloading can provide these, with intuitive syntax for their use.

This example, like many of the following ones, also uses the [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals) proposal as well.

```js
// Usage example
import { Decimal, _m } from "./decimal.mjs";
with operators from Decimal;  // Enable operator overloading for decimals

1_m + 2_m     // ==> 3_m
3_m * 2_m     // ==> 6_m
1_m == 1_m    // ==> true
1_m == 1      // ==> true
1 == 1m       // ==> true
1_m === 1     // ==> false (not overloadable)

// -------------
// decimal.mjs
// Implementation of the type

import Big from './big.mjs';  // https://github.com/MikeMcl/big.js/

// Decorator-based API for operator overloading
export
@Operators.overloaded
class Decimal extends Operators {
  #big;
  constructor(arg) { this.#big = new Big(arg); }

  @Operators.define("+")
  #plus(a, b) { return a.#big.plus(b.#big); }

  @Operators.define("*")
  #times(a, b) { return a.#big.times(b.#big); }

  @Operators.define("==")
  #decimalEqualsDecimal(a, b) { return a.#big.eq(b.#big); }

  @Operators.define("==", { left: Number })
  #numberEqualsDecimal(a, b) { return b.#big.eq(a); }

  @Operators.define("==", { right: Number })
  #decimalEqualsNumber(a, b) { return a.#big.eq(b); }
}

// Definition in terms of extensible literals proposal
export function _m(obj) {
  return new Decimal(obj.string);
}
```

### Matrix/vector computations

JavaScript is increasingly used for data processing and analysis, with libraries like [stdlib](https://stdlib.io/). These calculations are made a bit more awkward because things involving vector, matrix and tensor calculations need to be done all via method chaining, rather than more naturally using operators as they can in many other programming languages. Operator overloading could provide that natural phrasing.

```js
// Usage example
import { Vector } from "./vector.mjs";
with operators from Vector;

new Vector([1, 2, 3]) + new Vector([4, 5, 6])   // ==> new Vector([5, 7, 9])
3 * new Vector([1, 2, 3])                       // ==> new Vector([3, 6, 9])
new Vector([1, 2, 3]) == new Vector([1, 2, 3])  // ==> true
(new Vector([1, 2, 3]))[1]                      // ==> 2

// ----------------
// vector.mjs
// This example uses the "Imperative API".
// It would also be possible to write with the decorator-based API of the previous example.

const VectorOps = Operators({
  "+"(a, b) {
    return new Vector(a.contents.map((elt, i) => elt + b.contents[i]));
  },
  "=="(a, b) {
    return a.contents.length === b.contents.length &&
           a.contents.every((elt, i) => elt == b.contents[i]);
  },
  "[]"(a, b) {
    return a.contents[b];
  }
}, {
  left: Number,
  "*"(a, b) {
    return new Vector(b.contents.map(elt => elt * a));
  }
});

export class Vector extends VectorOps {
  contents;
  constructor(contents) {
    super();
    this.contents = contents;
  }
  get length() { return this.contents.length; }
}
Object.preventExtensions(Vector);  // ensure the operators don't change
```

### Equation DSLs

JavaScript is used in systems with equation-based DSLs, such as [TensorFlow.js](https://js.tensorflow.org/). In systems like TensorFlow, operators can be used to construct an abstract formula in other programming languages. Operator overloading could allow these formula DSLs to be expressed as infix expressions, as people naturally think of them.

For example, in TensorFlow.js's introductory tutorials, there is an [example](https://github.com/tensorflow/tfjs-examples/blob/master/polynomial-regression-core/index.js#L63) of an equation definition as follows:
```js
function predict(x) {
  // y = a * x ^ 3 + b * x ^ 2 + c * x + d
  return tf.tidy(() => {
    return a.mul(x.pow(tf.scalar(3, 'int32')))
      .add(b.mul(x.square()))
      .add(c.mul(x))
      .add(d);
  });
}
```

It's unfortunate that the equation has to be written twice, once to explain it and once to write it in code. With operator overloading and extensible literals, it might be written as follows instead:

```js
function predict(x) {
  // y = a * x ^ 3 + b * x ^ 2 + c * x + d
  return tf.tidy(() => {
    return a * x ** 3_int32
         + b * x ** 2_int32
         + c * x
         + d;
  });
}
```

At this point, maybe you don't even need that comment!

### Ergonomic CSS units calculations

Tab Atkins [proposed](https://www.xanthir.com/b4UD0) that CSS support syntax in JavaScript for CSS unit literals and operators. The [CSS Typed OM](https://drafts.css-houdini.org/css-typed-om-1/) turned out a bit different, with ergonomic affordances but without using new types of literals or operator overloading. With this proposal, in conjunction with [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals), we could have some more intuitive units calculations than the current function- and method-based solution.

In this case, the CSSNumericValue platform objects would come with operator overloading already enabled. Their definition in the CSS Typed OM specification would, indirectly, make use of the same JavaScript mechanism that

```js
with operators from CSSNumericValue;
const { _px, _em } = CSS;

document.querySelector("#element").style.paddingLeft = 3_em + 2_px;
```

## Design goals

- Expressivity
    - Support operator overloading on both mutable and immutable objects, and in the
      future, typed objects and value types.
    - Support operands of different types and the same type, as in the above examples.
    - Explain all of JS's behavior on existing types in terms of operator overloading.
    - Available in both strict and sloppy mode, with and without class syntax.
- Predicability
    - The meaning of operators on existing objects shouldn't be overridable
      or monkey-patchable, both for built-in types and for objects defined in
      other libraries.
    - It should not be possible to change the behavior of existing code
      using operators by unexpectedly passing it an object which overloads operators. (*If this is feasible.*)
    - Don't encourage a crazy coding style in the ecosystem.
- Efficiently implementable
    - In native implementations, don't slow down code which doesn't take advantage of operator overloading (including within a module that uses operator overloading in some other paths).
    - When operator overloading is used, it should lend itself to relatively efficient native implementations, including
          - In the startup path, when code is run just a few times
          - Lends itself well to inline caching (for both monomorphic and polymorphic cases) to reduce any overhead of the dispatch
          - Feasible to optimize in a JIT (for both monomorphic and polymorphic cases), with a minimal number of cheap hidden class checks, and without extremely complicated cases for when things become invalid
          - Don't create too much complexity in the implementation to support such performance
    - When enough type declarations are present, it should be feasible to implement efficiently in TypeScript, similarly to BigInt's implementation.
- Operator overloading should be a way of 'explaining the language' and providing hooks into something that's already there, rather than adding something which is a very different pattern from built-in operator definitions.

### Avoiding classic pitfalls of operator overloading and readability

The accusation is frequently made at C++ and Haskell that they are unreadable due to excessive use of obscure operators. On the other hand, in the Python ecosystem, operators are generally considered to make code significantly cleaner, e.g., in their use in NumPy.

This proposal includes several subtle design decisions to nudge the ecosystem in a direction of not using operator overloading in an excessive way, while still supporting the motivating case studies:
- Operators can be overloaded for one operand being a new user-defined type and the other operand being a previously defined type only in certain circumstances:
    - Strings only support overloading for `+` and the comparison operators.
    - Non-numeric, non-string primitives don't support overloading at all.
    - When one operand is an ordinary Object and the other is an Object with overloaded operators, the ordinary object is first coerced to some kind of primitive, making it less useful unless both operands were set up for overloading.
- ToPrimitive, ToNumber, ToString, etc are *not* extended to ever return non-primitives.
- Only built-in operators are supported; there are no user-defined operators.
- Using overloaded operators requires the `with operators from` statement, adding a little bit of friction, so overloaded operators are more likely to be used when they "pay for" that friction themselves from the perspective of a library user.

## Usage documentation

This section includes high-level for how to use and define overloaded operators, targeted at JavaScript programmers potentially using the feature. For low-level spec-like text, see [PROTOSPEC.md](https://github.com/littledan/proposal-operator-overloading/blob/master/PROTOSPEC.md).

### Using operators

With this proposal, operators can be overloaded on certain JavaScript objects that declare themselves as having overloaded operators.

The following operators may have overloaded behavior:
- Mathematical operators: unary `+`, `-`, `++`, `--`; binary `+`, `-`, `*`, `/`, `%`, `**`
- Bitwise operators: unary `~`; binary `&`, `^`, `|`, `<<`, `>>`, `>>>`
- Comparison operators: `==`, `<`, `>`, `<=`, `>=`
- Integer-indexed property access: `[]`, `[]=`

The definition of `>`, `<=` and `>=` is derived from `<`, and the definition of assigning operators like `+=` is derived  their corresponding binary operator, for example `+`.

The following operators do not support overloading:
- `!`, `&&`, `||` (boolean operations--always does ToBoolean first, and then works with the boolean)
- `===` and the built-in SameVale and SameValueZero operations (always uses the built-in strict equality definition)
- `.` and `[]` (these are property access; use Proxy to overload)
- `()` (calling a function--use a Proxy to overload)
- `,` (just returns the right operand)
- With future proposals, `|>`, `?.`, `?.[`, `?.(`, `??` (based on function calls, property access, and checks against the specific null/undefined values, so similar to the above)

To use operator overloading, import a module that exports a class, and enable operators on it using a `with operators from` declaration.

### `with operators from` declarations

Operator overloading is only enabled for the classes that you specifically opt in to. To do this overloading, use a `with operators from` declaration, follwed by a comma-separated list of classes that overload operators that you want to enable.

For example, if you have two classes, `Vector` and `Scalar`, which support overloaded operators, you can

```js
import { Vector, Scalar } from "./module.mjs";

new Vector([1, 2, 3]) * new Scalar(3);  // TypeError: operator overloading on Vector and Scalar is not enabled

with operators from Vector, Scalar;

new Vector([1, 2, 3]) * new Scalar(3);  // Works, returning new Vector([3, 6, 9])
````

The scope of enabling operators is based on JavaScript blocks (e.g., you can enable operators within a specific function, rather than globally). By default, built-in types like `String`, `Number` and `BigInt` already have operators enabled.

### Decorator definition interface

Recommended usage:
```js
@Operators.overloaded
class MyClass extends Operators {
  @Operators.define("+")
  static add(a, b) { /* ... */ }
}
```

The `Operators` object has two properties which are decorators:

#### `@Operators.define`

`@Operators.define` is a method decorator used to say that a particular method is used as the definition of an operator. The particular operator is indicated as a string argument to `@Operators.define`. The methods are called with two arguments, for both operands, and `undefined` as the `this` value.

An optional second argument can be of the form `{ left: OtherClass }` or `{ right: OtherClass }`--this will define the overload when `MyClass` is one operand and the other operand is an instance of `OtherClass`. To be accepted, the `OtherClass` must have this operator in the set of operators it's open to definitions for.

#### `@Operators.overloaded`

`@Operators.overloaded` is a class decorator used on classes that overload operators.

`@Operators.overloaded` takes a single optional argument, which is an options bag, that has one option, `open`, which is an Array of operators which are allowed to be overloaded by future types, with one operand being of this type and the other of a future-defined type.
  
Classes that define operators must extend `Operators`.

### Low-level, function-style definition interface

The above decorator interface provides convenient syntactic sugar over the functional interface, described in this section.

Recommended usage:
```js
const operators = Operators(operatorDefinitions [, leftOrRightOperatorDefinitions...])
class MyClass extends operators { /* ... */ }
Object.preventExtensions(MyClass);
```

The `Operators` function is called with one required argument, which is a dictionary of operator definitions. The property keys are operator names like `+` and the values are functions, which take two arguments, which implement the operator. The dictionary may also have an `open` property, as described for `@Operators.overloaded` above.

The subsequent parameters of `Operators` are similar dictionaries of operator definitions, used for defining the behavior of operators when one of the parameters is of a type declared previously: they must have either a `left:` or `right:` property, indicating the type of the other operand.

Note: The `Operators` function and the above decorators could be exposed from a [built-in module](https://github.com/tc39/proposal-javascript-standard-library/) rather than being a property of the global object, depending on how that proposal goes.

## Q/A

### How does this proposal compare to operator overloading in other languages?

For a detailed investigation, see [LANGCOMP.md](https://github.com/littledan/proposal-operator-overloading/blob/master/LANGCOMP.md). tl;dr:
- It's a pretty popular design choice to conservatively support overloading only on some operators, and to define some in terms of others, as this proposal does. User-defined operators have been difficult to varying extents in other programming languages.
- The way this proposal dispatches on the two operands is somewhat novel, most similar to Matlab. Unfortunately, of the established, popular mechanisms meet the design goals articulated in this document.

### Can this work with subclasses, rather than only defining overloading on base classes?

That would be equivalent to giving overloading behavior to existing objects. For example, the following code would add operator overloading behvior to an unsuspecting object if we permitted operator overloading to be triggered by a decorator on a class that inherited from any other class, rather than just inheriting from `Operators`:

```js
function addOverloads(obj) {
  class SuperClass { constructor() { return obj; } }
  @Operators.overloaded
  class SubClass extends SuperClass {
    @Operators.define("+")
    #add(a, b) { /* ... */ }
  }
  new SubClass(obj);
  return obj;
}
```
The reason that this would modify the existing instance is that `SubClass` would put operator overloading behavior on whatever is returned from the super constructor, and that super constructor returns the existing object! Even if you don't use `with operators from`, there is suddenly different behavior when using operators on the object (throwing exceptions).

Let's avoid this level of dynamic-ness, and make the language more predictable by keeping it a static, unchange-able property of an object whether it overloads operators or not.

### Can't we allow monkey-patching, for mocking, etc?

You can do mocking by creating a separate operator-overloaded class which works like the one you're trying to mock, or even interacts with it. Or, you can make your own hooks into the operator definitions to allow mocking. But letting any code reach into the definition of the operators for any other type risks making operators much less reliable than JavaScript programmers are acustomed to.

### Why does this have to be based on classes? I don't like classes!

It doesn't *have* to be based on classes, but the reason the above examples use inheritance is that a base class constructor gives a chance to return a truly unique object, with an internal slot that guides the overloading behavior. It's not clear how to get that out of object literals, but you can use the above API in a way like this, if you'd like:

```js
function makePoint(obj) { return Object.assign(new pointOps, obj); }
const pointOps = Operators({ "+"(a, b) { return makePoint({x: a.x + b.x, y: a.y + b.y}); });
let point = makePoint({ x: 1, y: 2 });
(point + point).y;  // 4
```

In the future, value types and/or value types might give a more ergonomic, non-class-based syntax.

### Why not use symbols instead of a whole new dispatch mechanism?

Symbols would allow monkey-patching and a general lack of robustness. They don't give a clear way to dispatch on the right operand, without requiring a *second* property access (like Python). The Python-style dispatch also has a left-to-right bias, which is unfortunate. Symbols also don't let us avoid doing additional property accesses on existing objects, the way that this proposal does enable us to do.

### Why doesn't this let me define my own operator token?

This proposal only allows overloading built-in operators, because:

- There's significant concern about "punctuation overload" in JavaScript programs, already growing more fragile with private fields/methods (`#`) and decorators (`@`). Too many kinds of punctuation could make programs hard to read.
- User-defined precedence for such tokens is unworkable to parse.
- Hopefully the [pipeline operator](https://github.com/tc39/proposal-pipeline-operator) and [optional chaining](https://github.com/tc39/proposal-optional-chaining) will solve many of the cases that would motivate these operators.
- We deliberately want to limit the syntactic divergence of JavaScript programs.

User-defined operator tokens may be a worthwhile proposal, but I (littledan) would be somewhat uncomfortable championing them for the above reasons.

### Why doesn't this proposal allow ordinary functions to be called in infix contexts?

For example, Haskell permits this capability, using backticks.

Such a capability could be useful, but it incurs the issues with adding more punctuation (see the previous Q/A entry), while not providing as terse results as overloading built-in operators. Method chaining or the pipeline operator can be used in many of the cases where infix function application could also be used.

### Should operator overloading use inheritance-based multiple dispatch involving the prototype chain?

This proposal has opted against using something like Slate's Prototype Multiple Dispatch, because:

- This is really complicated to implement and optimize reliably.
- It's not clear what important use cases there are that aren't solved by single-level dispatch.

### If you define your other-type overloads based on a previously defined type, how do you know which type came first?

If you have operators defined in two different modules, then to define overloads between them, import one module from the other, and don't make a circularity between the two. If you do this, the loading order wil lbe determinstic. The one that imports the other one is responsible for defining the overloads between the two types.

### How does operator overloading relate to other proposals?

#### BigInt

[BigInt](https://github.com/tc39/proposal-bigint/) provides definitions for how operators work on just one new type. This proposal generalizes that to types defined in JavaScript.

#### Typed Objects and Value Types

[Typed Objects](https://github.com/tschneidereit/proposal-typed-objects/blob/master/explainer.md) is a proposal for efficient, fixed-shape objects.

Value Types is an idea in TC39 about user-definable primitive types. At some points in the past, it was proposed that operator overloading be tied to value types.

When these proposals mature more, it will be good to look into how operator overloading can be enabled for Typed Objects and Value Types. The idea in this repository is to not limit operator overloading to those two types of values, but to also permit operator overloading for ordinary objects.

#### Extended numeric literals

The [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals) proposal allows numeric-like types such as `3_px` or `5.2_m` to be defined and used ergonomically.  Extended numeric literals and operator overloading fit well together, as the examples in this README show, but they don't depend on each other and can each be used separately.

### How does operator overloading interact with Proxy and membrane systems?

In this proposal, operators remain *not* operations visible in the meta-object protocol. Objects with overloaded operators don't even undergo the typical object coercion. However, this proposal still attempts to mesh well with membrane systems.

All operator-overloaded values are objects, so any technique that's used to create or access them can be mediated by membrane wrapping. The value returned from the membrane can be overloaded in a separate, membrane-mediated way, assuming collaboration between the overloaded object and the membrane system (otherwise there's no introspection API to see which operators to overload).

A membrane system which runs early in the program's execution (like the freeze-the-world systems) can monkey-patch and replace the `Operators` object to provide this collaboration; therefore, there is no need for any particular additional hooks. At a minimum, even without replacing the `Operators` object, the membrane can deny use of overloaded operators for the object on the other side of the membrane.

`with operator from` declarations provide a further defense: Those declarations prove that the piece of the program has access to (a piece of) the class defining overloaded operators. This works because the lookup of the internal slot `[[OperatorSetDefinition]]` does is not transparent to Proxies. A membrane system can deny access to that original operator set, and instead replace it with a separate class which overloads operators in a membrane-mediated way. In this way, even if an overloaded value "leaks", the right to call its operators is controlled by the class, which forms a capability object.

### Why does this include `[]`, which isn't an operator but rather property access?

ES6 introduced Proxy, which lets developers define custom semantics for property access. Unfortunately, this capability has certain issues:
- It's not possible to use both Proxy and the mechanism in this repository together, since operator overloading doesn't forward through Proxy.
- Proxy has proven difficult to optimize in JS engines, in part due to how general the interface is. The proposal for overloading `[]` is much more restricted in its power, potentially making it more optimizable.
- From the perspective of many JavaScript developers and even library authors, it's an "implementation detail" that array index access is based on JavaScript property access; for them, overloading this way is consistent with their mental model.

The overloading of `[]` proposed here is based on the semantics of Integer Indexed Exotic Objects, and doesn't add or change anything about JavaScript's meta-object protocol.
