
## Cross-language comparison

Most programming lanuguage designers have to consider operator semantics at some point, so we have a lot to refer to when considering the choices other languages have made.

### Which operators support overloading?

#### A static set of operators are overloadable

Languages: Python, Ruby, Lua, [Matlab](https://www.mathworks.com/help/matlab/matlab_oop/implementing-operators-for-your-class.html), Kotlin, C#, Rust ([considered and rejected](https://github.com/rust-lang/rfcs/issues/818)), [AssemblyScript](https://github.com/AssemblyScript/assemblyscript/blob/master/tests/compiler/std/operator-overloading.ts)

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
