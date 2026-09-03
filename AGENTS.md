# Rishum Server

The server is a TypeScript, Express, PostgreSQL, and Drizzle API for Rishum Plus.

## Development rules

- Keep TypeScript strict; avoid `any` and validate untrusted request input.
- Feature layering is mandatory. Every server feature must have exactly these three files, named consistently: `<feature>.controller.ts`, `<feature>.service.ts`, and `<feature>.dal.ts`.
  - **Controller:** HTTP boundary only — read `request`, call one service method, set the HTTP response, and pass errors to `next`. It must not contain validation rules, business decisions, Drizzle imports, database queries, transactions, or schema imports.
  - **Service:** owns input validation, authorization-independent business rules, workflow decisions, and `HttpError` creation. It must not import `db` or Drizzle query helpers.
  - **DAL:** owns every Drizzle import, query, mutation, transaction, and schema-table import. It returns data or absence to the service; it must not read Express requests or create HTTP responses.
  - Do not combine layers merely because a feature is small. Do not create sub-features or split a single business domain into multiple controller/service/DAL triplets. For example, all registration flow, field-catalog, and registration-submission operations belong to the single `registrations` feature and therefore use only `registrations.controller.ts`, `registrations.service.ts`, and `registrations.dal.ts`.
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
