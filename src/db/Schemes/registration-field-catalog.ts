import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const registrationFieldCatalog = pgTable("registration_field_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  profileKey: text("profile_key"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
