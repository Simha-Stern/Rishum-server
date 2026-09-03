import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { registrationFlowStatus } from "./enums.js";
import { institutions } from "./institutions.js";

export const registrationFlows = pgTable(
  "registration_flows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: registrationFlowStatus("status").notNull().default("draft"),
    publishedVersion: integer("published_version"),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("registration_flows_institution_idx").on(table.institutionId),
  ],
);
