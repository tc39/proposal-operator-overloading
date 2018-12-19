# Operator overloading in JavaScript

Should JavaScript support operator overloading? This document examines why we might consider it and how it could work.

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
  #plus(a, b) { return a.#big.times(b.#big); }

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
    - In native implementations, don't slow down code which doesn't take advantage of operator overloading (both within a module that uses operator overloading in some other paths, and .
    - When operator overloading is used, it should lend itself to relatively efficient native implementations, including
          - In the startup path, when code is run just a few times
          - Lends itself well to inline caching (for both monomorphic and polymorphic cases) to reduce any overhead of the dispatch
          - Feasible to optimize in a JIT (for both monomorphic and polymorphic cases), with a minimal number of cheap hidden class checks, and without extremely complicated cases for when things become invalid
          - Don't create too much complexity in the implementation to support such performance
    - When enough type declarations are present, it should be feasible to implement efficiently in TypeScript, similarly to BigInt's implementation.
- Operator overloading should be a way of 'explaining the language' and providing hooks into something that's already there, rather than adding something which is a very different pattern from built-in operator definitions.

## Usage documentation

This section includes high-level for how to use and define overloaded operators, targeted at JavaScript programmers potentially using the feature. For low-level spec-like text, see [PROTOSPEC.md](https://github.com/littledan/proposal-operator-overloading/blob/master/PROTOSPEC.md).

### Using operators

With this proposal, operators can be overloaded on certain JavaScript objects that declare themselves as having overloaded operators.

The following operators may have overloaded behavior:
- Mathematical operators: unary `+`, `-`, `++`, `--`; binary `+`, `-`, `*`, `/`, `%`, `**`
- Bitwise operators: unary `~`; binary `&`, `^`, `|`, `<<`, `>>`, `>>>`
- Comparison operators: `==`, `<`, `>`, `<=`, `>=`

The definition of `>`, `<=` and `>=` is derived from `<`, and the definition of assigning operators like `+=` is derived  their corresponding binary operator, for example `+`.

The following operators do not support overloading:
- `!`, `&&`, `||` (boolean operations--always does ToBoolean first, and then works with the boolean)
- `===` and the built-in SameVale and SameValueZero operations (always uses the built-in strict equality definition)
- `.` and `[]` (these are property access; use Proxy to overload)
- `()` (calling a function--use a Proxy to overload)
- `,` (just returns the right operand)
- With future proposals, `|>`, `?.`, `?.[`, `?.(`, `??` (based on function calls, property access, and checks against the specific null/undefined values, so similar to the above)

To use operator overloading, import a module that exports a class, and enable operators on it using a `with operators from` declaration.

#### `with operators from` declarations

Operator overloading is only enabled for the classes that you specifically opt in to. To do this overloading, use a `with operators from` declaration, follwed by a comma-separated list of classes that overload operators that you want to enable.

For example, if you have two classes, `Vector` and `Scalar`, which support overloaded operators, you can

```js
import { Vector, Scalar } from "./module.mjs";

new Vector([1, 2, 3]) * new Scalar(3);  // TypeError: operator overloading on Vector and Scalar is not enabled

with operators from Vector, Scalar;

new Vector([1, 2, 3]) * new Scalar(3);  // Works, returning new Vector([3, 6, 9])
````

The scope of enabling operators is based on JavaScript blocks (e.g., you can enable operators within a specific function, rather than globally). By default, built-in types like `String`, `Number` and `BigInt` already have operators enabled.

### Functional definition interface

The `Operators` object (which could be exposed from a [built-in module](https://github.com/tc39/proposal-javascript-standard-library/)) can be called as a function. Like arrow functions, it is not constructable. It is passed a variable number of arguments. The first argument is translates into the `[[SelfOperatorDefinition]]`, while subsequent arguments are individual entries in the `[[LeftOperatorDefinitions]]` or `[[RightOperatorDefinitions]]` lists (based on any `left:` or `right:` property they have).

### Decorator definition interface

The decorator interface provides convenient syntactic sugar over the functional interface above.

The `Operators` object has two properties which are decorators:
- `Operators.define`, a method decorator
- `Operators.overloaded`, a class decorator

## Cross-language comparison

Most programming lanuguage designers have to consider operator semantics at some point, so we have a lot to refer to when considering the choices other languages have made.

### Which operators support overloading?

#### A static set of operators are overloadable

Languages: Python, Ruby, Lua, [Matlab](https://www.mathworks.com/help/matlab/matlab_oop/implementing-operators-for-your-class.html), Kotlin, C#, Rust ([considered and rejected](https://github.com/rust-lang/rfcs/issues/818))

This seems to be the most common pattern. Within this, it's also common to define some operators in terms of others, as this proposal does.

#### Operators just don't have special syntax

Languages:  Common Lisp, Smalltalk, Self, Slate, Factor, Forth

- In the Lisp lineage (Common Lisp, Clojure, Scheme, Racket), code is written with prefix syntax. Function names can traditionally include operator characters.
- In the Forth lineage (Factor, Forth), operators are post-fix functions; tokens are typically delimited by spaces, so a function name can include punctuation/operator characters.
- In the Smalltalk lineage (Smalltalk, Self, Slate), operators are left-associative, all have the same precedence, and a message which begins with an operator-like character can omit the `:` and is always taken to have just one argument.

#### Predictable precedence, user-defined operators

Languages: OCaml, Scala, R

[OCaml operator precedence](https://caml.inria.fr/pub/docs/manual-ocaml/expr.html) is based on the initial character(s) of the operator.

R doesn't have operator overloading, but it lets programmers define their own operators in between `%`, e.g., `%abc%`, which are then treated as functions. Haskell has a related facility, where any function `f` can be used infix by enclosing it in backticks.

#### User-defined operator precedence

Languages: Haskell, Swift, Prolog

These can be especially difficult to parse! User-defined operator precedence is "anti-modular" since you need to import the precedence and associativity declarations of the imported modules in order to be able to even parse a particular module. Sometimes this ends up requiring multiple passes over the module graph in a practical implementation.

#### Takeaways

Allowing the built-in operators to be overloaded, and not supporting user-defined operators, is a middle-of-the-road, common design. The cross-language comparison validates this proposal's conservative choice, as user-defined operators cause issues in parsing and readability.

### Dispatch mechanism for operators

#### Operators are just functions, with no dispatch

Languages: ML, Forth, R (user-defined operators)

These languages may have operator syntax, but they just operate on a fixed type. In ML, the pattern is to use differnet operators for different types: For example, `+` for integers and `+.` for floats.

#### Built-in, fixed numeric tower

Languages: Java, C, Scheme, Factor, R (built-in operators), Clojure, Common Lisp, [Go](https://golang.org/doc/faq#overloading), PHP ([RFC](https://wiki.php.net/rfc/operator-overloading) apparently not yet in effect)

The choice to omit overloading is often a deliberate design decision. Excluding operator overloading and using a dependable set of built-in types is explained to enhance the predictability of code.

#### Static dispatch

Languages: C++, Swift

C++ overloads operators in a static way, with logic similar to its function type overloading mechanism. See [isocpp's FAQ](https://isocpp.org/wiki/faq/operator-overloading) for details.

[Swift operators](https://docs.swift.org/swift-book/LanguageGuide/AdvancedOperators.html) can be used as part of simple overloading (as in the examples in that page), or can be defined as part of a [protocol](https://docs.swift.org/swift-book/LanguageGuide/Protocols.html).

#### Dispatch based on the left operand

Languages: Smalltalk, Self, Ruby

Languages in the Smalltalk lineage (including Smalltalk, Self and Ruby) send the operator to the receiver directly as an ordinary message send.

#### Check the left operand, then the right, for possible overloads

Languages: Python, Lua

For `+`, Python checks for an `__add__` method on the left operand, and then an `__radd__` method on the right operand.  Similarly, for `+`, Lua will look in the metatable of the left operand for `__add`, and if it's missing, look in the metadatable for the right operand.

This enables useful patterns like multiplying a number by a vector, with the vector as the right operand, and the one that defines the overload.

However, it's hard to imagine how to implement this without significant performance overhead, and how to define it in a way that puts built-in types on a level playing field with user-defined objects with operator overloading.

#### Single dispatch based on both operands

Languages: [Haskell](http://hackage.haskell.org/package/base-4.12.0.0/docs/Prelude.html#t:Num), [Rust](https://doc.rust-lang.org/std/ops/index.html)

These langauges each have a way to define an interface which specifies that a method should have the receiver and an argument of the same type (or, in Rust's case, a concrete subclass can specify a type parameter for the second operand to override the default of being the same as the left operand). This technique is used in the definition of operators.

#### Full multimethods for operators

The only language I know of that works like this is Slate. See [the classic Slate paper](http://www.cs.cmu.edu/~aldrich/papers/ecoop05pmd.pdf) for more details on Slate's prototype multiple dispatch mechanism.

Common Lisp and Closure support multimethods, but the built-in arithmetic functions are *not* user-extendable multimethods. Instead, they have a fixed numeric tower.

Prototype multiple dispatch seems suboptimal because it requires a complex traversal of the inheritance hierarchy, and use cases are unclear. The Slate paper suggests dynamically changing the prototype as an object moves between "roles", which is not a popular idiom for that purposes in JavaScript as far as I know.

#### Call a method on the higher-precedence operand

Matlab's ["precedence"](https://www.mathworks.com/help/matlab/matlab_oop/object-precedence-in-expressions-using-operators.html) system handles operators by determining which operand has lower precedence, and calling the method on the operand with higher precedence. Precedence is indicated with the InferiorClasses property, rather than implicitly based on execution order as in this proposal.

#### Takeaways

The proposal here is most similar to Matlab semantics, and differs from operator dispatch in most object-oriented programming languages. We have good reasons here for not using property access for operator overloading, but we should proceed with caution.

### Ecosystem: Do operators tend to make things unreadable?

The accusation is frequently made at C++ and Haskell that they are unreadable due to excessive use of obscure operators. On the other hand, in the Python ecosystem, operators are generally considered to make code significantly cleaner, e.g., in their use in NumPy. It's not clear what leads to the difference, or how we could drive a positive, clean-code culture here.

## Q/A

### Can this work with subclasses, as a mixin?

That would be equivalent to giving overloading behavior to existing objects (since an instance is never "done initializing"). Let's avoid that.

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

- User-defined precedence for such tokens is unworkable to parse.
- Hopefully the [pipeline operator](https://github.com/tc39/proposal-pipeline-operator) and [optional chaining](https://github.com/tc39/proposal-optional-chaining) will solve many of the cases that would motivate these operators.
- We deliberately want to limit the syntactic divergence of JavaScript programs.

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
