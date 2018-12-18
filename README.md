# Operator overloading in JavaScript

Should JavaScript support operator overloading? This document examines why we might consider it and how it could work.

## Case studies

### Numeric types

JavaScript has a very restricted set of numeric types. Traditionally, it had just Number: an IEEE-754 double-precision binary float. The [BigInt proposal](http://github.com/tc39/proposal-bigint/) (shipping in Chrome) added a single new numeric type for arbitrary-size integers. But there are more numeric types that developers need in practice, such as decimals, rationals, complex numbers, etc. Operator overloading can provide these, with intuitive syntax for their use.

This example, like many of the following ones, also uses the [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals) proposal as well.

```js
import Big from './big.mjs';  // https://github.com/MikeMcl/big.js/

// Decorator-based API for operator overloading
@Operators.overloaded
class Decimal extends Operators {
  #big;
  constructor(arg) { this.#big = new Big(arg); }

  @Operators.define("+")
  #plus(a, b) { return a.plus(b); }

  @Operators.define("*")
  #plus(a, b) { return a.times(b); }

  @Operators.define("==")
  #decimalEqualsDecimal(a, b) { return a.eq(b); }

  @Operators.define("==", { left: Number })
  #numberEqualsDecimal(a, b) { return b.eq(a); }

  @Operators.define("==", { right: Number })
  #decimalEqualsNumber(a, b) { return a.eq(b); }
}

// Definition in terms of extensible literals proposal
function _m(obj) { return new Decimal(obj.string); }

// Usage:
with operators from Decimal;  // Enable operator overloading for decimals

1_m + 2_m     // ==> 3_m
3_m * 2_m     // ==> 6_m
1_m == 1_m    // ==> true
1_m == 1      // ==> true
1 == 1m       // ==> true
1_m === 1     // ==> false (not overloadable)
```

### Matrix/vector computations

JavaScript is increasingly used for data processing and analysis, with libraries like [stdlib](https://stdlib.io/). These calculations are made a bit more awkward because things involving vector, matrix and tensor calculations need to be done all via method chaining, rather than more naturally using operators as they can in many other programming languages. Operator overloading could provide that natural phrasing.

```js
// This example uses the "Imperative API".
// It would also be possible to write with the decorator-based API of the previous example.

const VectorOps = Operators({
  "+"(a, b) {
    return new Vector(a.contents.map((elt, i) => elt + b.contents[i]));
  },
  "=="(a, b) {
    return a.contents.length === b.contents.length &&
           a.contents.every((elt, i) => elt == b.contents[i]);
  }
}, {
  left: Number,
  "*"(a, b) {
    return new Vector(b.contents.map(elt => elt * a));
  }
});

class Vector extends VectorOps {
  contents;
  constructor(contents) {
    super();
    this.contents = contents;
  }
}
Object.preventExtensions(Vector);  // ensure the operators don't change

// Usage:
with operators from Vector;

new Vector([1, 2, 3]) + new Vector([4, 5, 6])   // ==> new Vector([5, 7, 9])
3 * new Vector([1, 2, 3])                       // ==> new Vector([3, 6, 9])
new Vector([1, 2, 3]) == new Vector([1, 2, 3])  // ==> true
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

In this case, the CSSUnitValue platform objects would come with operator overloading already enabled. Their definition in the CSS Typed OM specification would, indirectly, make use of the same JavaScript mechanism that

```js
with operators from CSSUnitValue;
const { _px, _em } = CSS;

document.querySelector("#element").style.paddingLeft = 3_em + 2_px;
```

### Explain the platform

JavaScript already has three types which have a meaning for operators like `+`: String, BigInt and Number. Operator overloading would make these built-in types a little less special.

## Design goals

- Expressivity
    - Support operator overloading on both mutable and immutable objects, and in the
      future, typed objects and value types.
    - Support operands of different types and the same type, as in the above examples.
    - Explain all of JS's behavior on existing types in terms of operator overloading.
    - Available in both strict and sloppy mode, with and without class syntax.
- Performance/predicability
    - Don't slow down code which doesn't take advantage of operator overloading.
    - The meaning of operators on existing objects shouldn't be overridable
      or monkey-patchable, both for built-in types and for objects defined in
      other libraries.
    - It should not be possible to change the behavior of existing code
      using operators by unexpectedly passing it an object which overloads operators.

### Non-goals

- User-defined operator tokens
    - User-defined precedence for such tokens is unworkable to parse
    - Hopefully the [pipeline operator](https://github.com/tc39/proposal-pipeline-operator) and [optional chaining](https://github.com/tc39/proposal-optional-chaining) will solve many of the cases that would motivate these operators
    - We deliberately want to limit the syntactic divergence of JavaScript programs
- Inheritance-based multiple dispatch using the prototype chain
    - This is really complicated to implement and optimize reliably
    - It's not clear what important use cases there are that aren't solved by single-level dispatch

## Mechanism

Operators is a function which returns a class that can be inherited from. 

### Implementation notes

*Warning: Wild speculation follows; others will have more realistic input for operator overloading*

The implementation experience of BigInt showed that it wasn't hard to add an extra "else case" to existing operators while avoiding slowing down existing code. The hard part will be ensuring that operator overloading is cheap when it's used.

The implementation can take advantage of the fact that the operators are something overloaded in the base class. In V8, for example, an object with overloaded operators might be representable as its own `instance_type` (one `instance_type` for all objects with overloaded operators), making it cheap to check whether operators are overloaded at all. (BigInt is also distinguished using the `instance_type`.)

The actual link to the operators can be found with `GetConstructor()`, avoiding extra memory overhead on the map (at the expense of finding those operators requiring a traversal). There does not need to be any logic to invalidate the found operators (`PrototypeInfo`-style), as they cannot be changed. An object never transitions between having operators overloaded and not, and never changes which operator overloadings apply to it.

Within code generated by a JIT, or an inline cache, a map check of both operands should be sufficient to dispatch to the same operator implementation. No invalidation logic is needed, as long as it's the same map.

To include the checks about whether operators are currently in use, an extra check will be required, and it will be hard to optimize away this check. A single `with operators` declaration can run multiple times with different values running through it, and this must be handled properly. The idea would be to include the mask of permitted operator indices as an implicit lexically scoped variable which contains a bitmask, and check whether the arguments have those indices enabled before each overloaded operation. This mask will never change after being initialized. An inline cache can reduce the overhead of the check by checking that the identity of the bitmask object is the same as what was expected, which will imply that its contents are the same. It's possible that the overhead will be considered too great here to do the extra checks in practice.

## Q/A

### Can this work with subclasses, as a mixin?

That would be equivalent to giving overloading behavior to existing objects (since an instance is never "done initializing"). Let's avoid that.

### How does this relate to other proposals?

#### BigInt

[BigInt](https://github.com/tc39/proposal-bigint/) provides definitions for how 

#### Typed Objects and Value Types

[Typed Objects](https://github.com/tschneidereit/proposal-typed-objects/blob/master/explainer.md) is a proposal for efficient, fixed-shape objects.

Value Types is an idea in TC39 about user-definable primitive types. At some points in the past, it was proposed that operator overloading be tied to value types.

When these proposals mature more, it will be good to look into how operator overloading can be enabled for Typed Objects and Value Types. The idea in this repository is to not limit operator overloading to those two types of values, but to also permit operator overloading for ordinary objects.

#### Extended numeric literals

The [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals) proposal allows numeric-like types such as `3_px` or `5.2_m` to be defined and used ergonomically.  Extended numeric literals and operator overloading fit well together, as the examples in this README show, but they don't depend on each other and can each be used separately.
