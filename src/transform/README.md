This package implements an [operator overloading proposal](https://github.com/littledan/proposal-operator-overloading/) for JavaScript as a Babel plugin.

To use the plugin, run the following commands for installation

```sh
npm install --save-dev @littledan/plugin-transform-operator-overloading
npm install --save-prod @littledan/operator-overloading-shim
```

and add the following to your `.babelrc`:

```js
{
  "plugins": ["@littledan/plugin-transform-operator-overloading"]
}
```

If you encounter any issues, including unexpected behavior, poor performance, weird ergonomics, etc, please [file an issue](https://github.com/littledan/proposal-operator-overloading/issues/new).

## Recommended best practices

- Use `with operators from` declarations just in code that needs it, rather than at the top level of the module. This makes the transformation only apply to that code, reducing the predictability and performance impact.
- When creating a library that exposes operator overloading, expose a method-based interface as well, to support usage without this transform.
- Note that overloading [] or []= results in the creation of a Proxy; carefully consider whether this is appropriate for performance-sensitive code.

## Deviations from proto-specification behavior

- Rather than using the syntax `with operators from ABC`, use the syntax `withOperatorsFrom(ABC)`
- When outside of any block which has a `with operators from` declaration, this transform treats objects with overloaded operators as if they didn't have overloading (and therefore undergo coercion like objects), whereas the spec behavior would be to throw a TypeError.
- The underlying operator-overloading-shim does not protect against introspection of symbols or monkey-patching in the environment. Error checking behavior may be somewhat weaker.
