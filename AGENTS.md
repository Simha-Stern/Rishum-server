# Rishum Server

The server is a TypeScript, Express, PostgreSQL, and Drizzle API for Rishum Plus.

## Development rules

- Keep TypeScript strict; avoid `any` and validate untrusted request input.
- Keep HTTP controllers thin. Put reusable business logic in services and database access in DAL modules.
- Route expected failures through `HttpError` and Express's `next(error)` so the shared error middleware can respond and log consistently.
- Use the shared `logger` from `src/utils/logger.ts`; do not use `console.log`, `console.warn`, or `console.error`.
- Do not log access tokens, passwords, or request bodies containing personal data.

## Local skills

- Project-specific skills are stored in `.agents/skills/`.
- Before working on an area covered by a local skill, read that skill's `SKILL.md` and follow its instructions.

## Commands

- `npm run dev`: start the development server.
- `npm run typecheck`: check TypeScript types.
- `npm run db:generate`: generate a Drizzle migration.
- `npm run db:migrate`: apply migrations.
