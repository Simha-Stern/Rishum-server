import { integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { registrationFlows } from './registration-flows.js';
import { users } from './users.js';

export const registrationFormVersions = pgTable(
  'registration_form_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    flowId: uuid('flow_id').notNull().references(() => registrationFlows.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('registration_form_versions_flow_version_unique').on(table.flowId, table.version)],
);
