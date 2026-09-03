import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { registrationStatus } from "./enums.js";
import { institutions } from "./institutions.js";
import { registrationFormVersions } from "./registration-form-versions.js";
import { users } from "./users.js";

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    formVersionId: uuid("form_version_id")
      .notNull()
      .references(() => registrationFormVersions.id),
    status: registrationStatus("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("registrations_institution_submitted_idx").on(
      table.institutionId,
      table.submittedAt,
    ),
    index("registrations_user_id_idx").on(table.userId),
  ],
);
