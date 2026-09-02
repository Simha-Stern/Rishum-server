import { boolean, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { registrationFormVersions } from './registration-form-versions.js';

export const registrationFields = pgTable(
  'registration_fields',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    formVersionId: uuid('form_version_id').notNull().references(() => registrationFormVersions.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: text('type').notNull(),
    required: boolean('required').notNull().default(false),
    options: jsonb('options').$type<string[]>().notNull().default([]),
    profileKey: text('profile_key'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [uniqueIndex('registration_fields_version_key_unique').on(table.formVersionId, table.key)],
);
