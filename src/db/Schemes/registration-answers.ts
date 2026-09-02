import { jsonb, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { registrationFields } from './registration-fields.js';
import { registrations } from './registrations.js';

export const registrationAnswers = pgTable(
  'registration_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    registrationId: uuid('registration_id').notNull().references(() => registrations.id, { onDelete: 'cascade' }),
    fieldId: uuid('field_id').notNull().references(() => registrationFields.id),
    value: jsonb('value').$type<string | number | boolean | string[] | null>().notNull(),
  },
  (table) => [uniqueIndex('registration_answers_registration_field_unique').on(table.registrationId, table.fieldId)],
);
