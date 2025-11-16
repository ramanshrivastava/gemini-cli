# ADR-001: TypeScript Configuration and Project Setup

## Context

We need to set up a TypeScript project that:
1. Compiles to modern JavaScript for Node.js
2. Enforces strict type checking to catch errors early
3. Uses ES modules (not CommonJS) for better tree-shaking and compatibility
4. Supports incremental builds for faster development

The target runtime is Node.js 20+ with ESM support.

## Decision

Use TypeScript with the following key configurations:
- `"strict": true` - Enable all strict type checking options
- `"module": "NodeNext"` - Use Node.js's native ESM resolution
- `"moduleResolution": "nodenext"` - Match Node.js's resolution algorithm
- `"target": "es2022"` - Compile to modern JavaScript
- `"verbatimModuleSyntax": true` - Require explicit `type` imports

## Alternatives Considered

### 1. JavaScript with JSDoc
**Pros:**
- No compilation step
- Simpler tooling
- Faster startup

**Cons:**
- Weaker type checking
- No compile-time errors for complex types
- Harder to maintain in large codebases

**Why rejected:** Type safety is critical for a tool handling file I/O and shell execution

### 2. TypeScript with `"moduleResolution": "node"`
**Pros:**
- More permissive (easier to get started)
- Compatible with older Node.js

**Cons:**
- Doesn't match Node.js's actual ESM resolution
- Can lead to runtime errors TypeScript doesn't catch
- Deprecated in favor of `nodenext`

**Why rejected:** Want TypeScript to match Node.js behavior exactly

### 3. CommonJS (`"module": "commonjs"`)
**Pros:**
- More mature ecosystem
- Better tooling support historically

**Cons:**
- No top-level await
- Worse tree-shaking
- Being phased out by Node.js ecosystem

**Why rejected:** ESM is the future, Gemini API SDK uses ESM

## Rationale

### Why Strict Mode?
Gemini CLI uses these strict options (from `/home/user/gemini-cli/tsconfig.json:3-16`):
```json
{
  "strict": true,
  "noImplicitAny": true,
  "noImplicitOverride": true,
  "noImplicitReturns": true,
  "noImplicitThis": true,
  "forceConsistentCasingInFileNames": true,
  "noPropertyAccessFromIndexSignature": true,
  "noUnusedLocals": true,
  "strictBindCallApply": true,
  "strictFunctionTypes": true,
  "strictNullChecks": true,
  "strictPropertyInitialization": true
}
```

**Benefit**: Catches entire classes of errors at compile time:
- Null/undefined access → crashes prevented by `strictNullChecks`
- Unused variables → code smell caught by `noUnusedLocals`
- Typos in file paths → caught by `forceConsistentCasingInFileNames`

**Example - Without strict mode:**
```typescript
// This compiles but crashes at runtime
function readConfig(path?: string) {
  return JSON.parse(fs.readFileSync(path)); // path might be undefined!
}
```

**With strict mode:**
```typescript
// TypeScript error: Object is possibly 'undefined'
function readConfig(path?: string) {
  if (!path) throw new Error('Path required');
  return JSON.parse(fs.readFileSync(path)); // Safe
}
```

### Why NodeNext?
From the @google/genai SDK package.json:
```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

The SDK is pure ESM. Using `"module": "NodeNext"` ensures our imports work correctly:

**Correct (with NodeNext):**
```typescript
import { createClient } from '@google/genai'; // Works
```

**Incorrect (with "commonjs"):**
```typescript
const { createClient } = require('@google/genai'); // Runtime error!
// Error: require() of ES Module not supported
```

### Why verbatimModuleSyntax?
This flag requires explicit `type` keyword for type-only imports.

**Without verbatimModuleSyntax:**
```typescript
import { Content } from '@google/genai'; // Is this a type or value?
```

After compilation → JavaScript:
```javascript
// TypeScript might remove this import entirely if only used as type
// → Runtime error if Content is referenced elsewhere
```

**With verbatimModuleSyntax:**
```typescript
import type { Content } from '@google/genai'; // Explicit: type-only
import { createClient } from '@google/genai'; // Explicit: runtime value
```

After compilation:
```javascript
// type import is ALWAYS removed
import { createClient } from '@google/genai'; // Always kept
```

**Benefit**: No ambiguity, no accidental runtime imports of types.

## Gemini CLI Reference

**File**: `/home/user/gemini-cli/tsconfig.json`
**Lines**: 1-32
**Commit**: add233c5 (April 15, 2025 - Initial commit)

**Key snippet:**
```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "target": "es2022",
    "verbatimModuleSyntax": true,
    "lib": ["ES2023"],
    "types": ["node", "vitest/globals"],
    "composite": true,
    "incremental": true
  }
}
```

## Historical Context

This configuration existed from **day one** of the public release (April 15, 2025). This suggests:

1. **Internal development used TypeScript from the start** - not a later migration
2. **Strict mode was enforced early** - prevented accumulation of type-unsafe code
3. **ESM-only decision** - made before CommonJS compatibility was considered

This is significant because many projects migrate to strict mode gradually. Gemini CLI started strict, indicating:
- Strong type safety culture at Google
- Recognition that file I/O tools need maximum safety
- Willingness to pay upfront cost (slower initial development) for long-term reliability

## Trade-offs

### Benefits
✅ **Type Safety**: Entire classes of bugs caught at compile time
✅ **Editor Support**: IntelliSense, autocomplete, inline errors
✅ **Refactoring Confidence**: Rename, extract, move code safely
✅ **Documentation**: Types serve as inline documentation
✅ **Future-Proof**: ESM is Node.js's future

### Limitations
❌ **Compilation Step**: Must run `tsc` before execution (adds ~2-5 seconds)
❌ **Learning Curve**: Developers must understand TypeScript
❌ **Build Complexity**: Need build tooling (tsc, package.json scripts)
❌ **Stricter Rules**: More code required to satisfy type checker

**Example of the cost:**
```typescript
// JavaScript: 1 line
const config = JSON.parse(fs.readFileSync(path));

// TypeScript (strict): 5 lines
const rawConfig = fs.readFileSync(path, 'utf-8');
const parsed: unknown = JSON.parse(rawConfig);
if (typeof parsed !== 'object' || !parsed) {
  throw new Error('Invalid config');
}
const config = parsed as Config; // Assume Config is defined elsewhere
```

**Why the cost is worth it:**
If `path` doesn't exist or JSON is malformed, we get a clear error at the right place, not a mysterious crash 100 lines later.

## Learning Outcomes

After setting up TypeScript with these configurations, you should understand:

1. **Type Erasure**: TypeScript types don't exist at runtime
   ```typescript
   function greet(name: string) { // Type annotation here
     console.log(name);
   }

   // Compiles to:
   function greet(name) { // No type annotation in JS
     console.log(name);
   }
   ```

2. **Module Resolution**: How Node.js finds modules
   ```typescript
   import { foo } from './bar.js'; // Must include .js extension!
   // NOT: import { foo } from './bar'; // Error with NodeNext
   ```

3. **Strict Null Checks**: Difference between `T` and `T | undefined`
   ```typescript
   function parse(input: string): Config { /* ... */ }

   const maybeInput: string | undefined = getInput();
   parse(maybeInput); // Error: Argument of type 'string | undefined' is not assignable

   if (maybeInput !== undefined) {
     parse(maybeInput); // OK: TypeScript narrows type
   }
   ```

4. **Type vs. Value Imports**: When to use `import type`
   ```typescript
   import type { Content } from '@google/genai'; // Type-only (erased)
   import { createClient } from '@google/genai'; // Runtime value (kept)

   const content: Content = { role: 'user', parts: [] }; // OK
   console.log(Content); // Error: 'Content' only refers to a type
   ```

## Future Considerations

### Potential Evolution
1. **TypeScript 6.x**: May introduce new strict flags
2. **Decorators**: If agent framework uses dependency injection
3. **Path Mapping**: For cleaner imports (`@/tools` instead of `../../tools`)

### Questions to Revisit
- **When to relax strict mode?** (e.g., for generated code)
- **Should we use `noUncheckedIndexedAccess`?** (Even stricter array access)
- **How to handle third-party untyped libraries?** (DefinitelyTyped vs. declare module)

### Experiment Ideas
1. **Try breaking strict mode**: Remove `strictNullChecks`, see what errors you miss
2. **Compare bundle sizes**: ESM vs. CommonJS with same code
3. **Measure compilation time**: `tsc` vs. `esbuild` vs. `swc`

---

## Checkpoint Quiz

**Question 1**: What happens to this code at runtime?
```typescript
import type { Content } from '@google/genai';
import { createClient } from '@google/genai';

function test(content: Content) {
  console.log(content);
}
```

<details>
<summary>Answer</summary>

After TypeScript compilation, the JavaScript looks like:
```javascript
import { createClient } from '@google/genai';
// import type is completely erased

function test(content) { // No type annotation
  console.log(content);
}
```

The `Content` type exists **only during compilation** to help TypeScript check your code. At runtime, JavaScript doesn't know about `Content`.
</details>

---

**Question 2**: Why does this fail with `moduleResolution: nodenext`?
```typescript
import { readFileSync } from 'fs';
```

<details>
<summary>Answer</summary>

It doesn't fail! This is correct. Node.js built-in modules (like `fs`, `path`, `http`) don't need file extensions.

What WOULD fail:
```typescript
import { myUtil } from './utils'; // Error: Must include extension
```

Correct:
```typescript
import { myUtil } from './utils.js'; // OK (even though source is utils.ts!)
```

This is because Node.js ESM requires explicit extensions for relative imports.
</details>

---

**Question 3**: What's the difference?
```typescript
const config: Config = getConfig();        // A
const config = getConfig() as Config;      // B
const config = <Config>getConfig();        // C
```

<details>
<summary>Answer</summary>

- **A (Type Annotation)**: TypeScript **checks** that `getConfig()` returns `Config`
  - If `getConfig(): Config | null`, this is a **compile error**

- **B (Type Assertion with `as`)**: You **tell** TypeScript "trust me, this is Config"
  - If `getConfig()` returns `null`, compiles fine but **crashes at runtime**

- **C (Angle Bracket Assertion)**: Same as B, but doesn't work in `.tsx` files (conflicts with JSX)
  - Gemini CLI uses React/Ink, so this syntax is avoided

**Best Practice**: Prefer A (annotation) over B/C (assertion). Only use assertions when you know more than TypeScript (e.g., after runtime checks).
</details>

---

## Practical Exercise

**Task**: Set up a minimal TypeScript project with the same strictness as Gemini CLI.

**Steps**:
1. Create `package.json`:
   ```json
   {
     "name": "mini-gemini-cli",
     "version": "0.1.0",
     "type": "module",
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch"
     },
     "devDependencies": {
       "typescript": "^5.3.3",
       "@types/node": "^20.0.0"
     }
   }
   ```

2. Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "module": "NodeNext",
       "moduleResolution": "nodenext",
       "target": "es2022",
       "verbatimModuleSyntax": true,
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*"]
   }
   ```

3. Create `src/index.ts`:
   ```typescript
   console.log('Hello, TypeScript!');
   ```

4. Build and run:
   ```bash
   npm install
   npm run build
   node dist/index.js
   ```

**Expected Output**:
```
Hello, TypeScript!
```

**Bonus Challenge**: Try violating strict mode rules and see what errors you get:
```typescript
// Add to src/index.ts
function greet(name: string | undefined) {
  console.log(name.toUpperCase()); // What error does this cause?
}
```

<details>
<summary>Answer</summary>

Error:
```
Object is possibly 'undefined'.ts(2532)
```

TypeScript catches that `name` might be `undefined`, and calling `.toUpperCase()` on `undefined` would crash.

Fix:
```typescript
function greet(name: string | undefined) {
  if (!name) return;
  console.log(name.toUpperCase()); // OK: TypeScript knows name is string here
}
```
</details>

---

**End of ADR-001**
