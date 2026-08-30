import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const institutionMemberRole = pgEnum('institution_member_role', ['manager', 'secretary']);
export const registrationFlowStatus = pgEnum('registration_flow_status', ['draft', 'published', 'closed']);
export const registrationStatus = pgEnum('registration_status', ['submitted', 'under_review', 'accepted', 'rejected']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    idNumber: text('id_number'),
    isSystemAdmin: boolean('is_system_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
  ],
);

export const institutions = pgTable('institutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const institutionMemberships = pgTable(
  'institution_memberships',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
    role: institutionMemberRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('institution_memberships_user_institution_unique').on(table.userId, table.institutionId),
    index('institution_memberships_institution_idx').on(table.institutionId),
  ],
);

export const registrationFlows = pgTable(
  'registration_flows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: registrationFlowStatus('status').notNull().default('draft'),
    publishedVersion: integer('published_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('registration_flows_institution_unique').on(table.institutionId)],
);

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

export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id),
    formVersionId: uuid('form_version_id').notNull().references(() => registrationFormVersions.id),
    status: registrationStatus('status').notNull().default('submitted'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('registrations_institution_submitted_idx').on(table.institutionId, table.submittedAt),
    index('registrations_user_id_idx').on(table.userId),
  ],
);

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

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_logs_institution_created_idx').on(table.institutionId, table.createdAt)],
);
