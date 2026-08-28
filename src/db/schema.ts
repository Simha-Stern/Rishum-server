import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const institutions = pgTable('institutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
});
