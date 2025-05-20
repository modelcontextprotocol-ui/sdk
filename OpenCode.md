# MPC-UI SDK Development Guide

## Build & Test Commands
- Build: `pnpm run build`
- Development mode: `pnpm run dev`
- Lint: `pnpm run lint`
- Lint & fix: `pnpm run lint:fix`
- Type check: `pnpm run check`
- Format code: `pnpm run format`
- Run all tests: `pnpm run test`
- Run single test: `pnpm run test -- -t "test name"`
- Watch tests: `pnpm run test -- --watch`

## Code Style Guidelines
- Use TypeScript with strict type checking
- Follow ESLint rules from @sxzz/eslint-config
- Use Prettier with @sxzz/prettier-config
- Use ES modules (import/export) not CommonJS
- Use camelCase for variables/functions, PascalCase for classes/interfaces
- Use descriptive interface names with 'I' prefix
- Wrap error handling in try/catch blocks with proper logging
- Use async/await for asynchronous code
- Document public APIs with JSDoc comments
- Use enums for fixed sets of values
- Use type guards for runtime type checking
- Prefer readonly properties when possible
- Use private class fields for implementation details