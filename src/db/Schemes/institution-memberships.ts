import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { institutionMemberRole } from "./enums.js";
import { institutions } from "./institutions.js";
import { users } from "./users.js";

export const institutionMemberships = pgTable(
  "institution_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    role: institutionMemberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("institution_memberships_user_institution_unique").on(
      table.userId,
      table.institutionId,
    ),
    index("institution_memberships_institution_idx").on(table.institutionId),
  ],
);
