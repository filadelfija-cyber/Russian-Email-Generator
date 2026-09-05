---
name: CI TypeScript project references
description: The required build order for composite TypeScript libraries and dependent app checks in CI.
---

Composite TypeScript projects must be built before type-checking an application that references them. In a clean CI checkout, declaration outputs such as `dist/index.d.ts` do not exist yet, so checking the dependent app directly can produce TS6305.

**Why:** The mobile app uses a TypeScript project reference to a workspace API client library, while generated declaration outputs are not tracked in git.

**How to apply:** After dependency installation and before app-specific type-checks, run the workspace library build (`pnpm run typecheck:libs` or the equivalent project-reference build).