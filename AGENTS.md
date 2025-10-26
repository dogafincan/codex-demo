# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the App Router entry points; `page.tsx` renders the Pomodoro UI, `layout.tsx` wires shared metadata, and `globals.css` loads Tailwind resets.
- `components/ui/` holds reusable primitives (Button, Dialog, Tabs); extend these before creating ad-hoc UI.
- `hooks/` stores custom React hooks such as `use-local-storage`; keep side-effect logic here.
- `lib/utils.ts` houses pure helpers for time math and formatting; new utilities belong here.
- `public/` serves static assets (favicons, images). Reference them with absolute paths like `/favicon.ico`.

## Build, Test, and Development Commands
- `npm run dev` starts the Next.js dev server on `http://localhost:3000` with hot reloading.
- `npm run build` compiles a production bundle; use it to validate release readiness.
- `npm run start` serves the compiled bundle locally for a production-like smoke test.
- `npm run lint` runs ESLint with the project rules; add `--fix` for safe autofixes before committing.

## Coding Style & Naming Conventions
- Write TypeScript throughout; use `.tsx` for React components and `.ts` for utilities.
- Follow the existing 2-space indentation, trailing semicolons, and single quotes only when required.
- Name components in PascalCase and hooks in camelCase prefixed with `use`.
- Prefer the `@/` path alias instead of fragile relative paths; update `tsconfig.json` if you add aliases.
- Tailwind utility classes stay inline; order them logically (layout → spacing → color) to aid reviews.

## Testing Guidelines
- Automated tests are not yet in place; start by covering `lib/utils.ts` helpers and hook behavior.
- Co-locate tests in `__tests__/` mirrors or `*.test.ts(x)` files alongside the source.
- Adopt Vitest or Jest with Testing Library; document the chosen runner and add an `npm run test` script when introduced.
- Target coverage for session flow calculations, persistent storage, and regression-prone UI state before expanding features.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects (`Add timer reset shortcut`); include context in bodies wrapped near 72 characters.
- Reference issues with `Fixes #ID` when applicable and group related changes into a single commit.
- PRs should summarise the goal, call out noteworthy implementation details, attach UI screenshots or GIFs, and list follow-up tasks.
- Run `npm run lint` (and any added tests) before requesting review; note the commands and outcomes in the PR description.

## Environment & Configuration
- Store secrets in `.env.local`; never commit runtime tokens, API keys, or user data.
- Document new environment variables, PostCSS, or Tailwind configuration changes in the PR and update `README.md` if setup steps change.
