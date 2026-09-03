import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { institutionMemberRole } from "./enums.js";
import { institutions } from "./institutions.js";
import { users } from "./users.js";

export const institutionInvitations = pgTable(
  "institution_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email").notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: institutionMemberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("institution_invitations_institution_email_unique").on(
      table.institutionId,
      table.invitedEmail,
    ),
    index("institution_invitations_email_idx").on(table.invitedEmail),
  ],
);
