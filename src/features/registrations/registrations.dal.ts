import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  auditLogs,
  registrationAnswers,
  registrationFieldCatalog,
  registrationFields,
  registrationFlows,
  registrationFormVersions,
  registrations,
  users,
} from "../../db/Schemes/index.js";

export type RegistrationFieldSnapshot = {
  catalogFieldId: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  profileKey: string | null;
  sortOrder: number;
};

export const registrationsDal = {
  listCatalog: () =>
    db
      .select()
      .from(registrationFieldCatalog)
      .orderBy(registrationFieldCatalog.label),
  async findCatalogByKey(key: string) {
    const [field] = await db
      .select({ id: registrationFieldCatalog.id })
      .from(registrationFieldCatalog)
      .where(eq(registrationFieldCatalog.key, key))
      .limit(1);
    return field ?? null;
  },
  async createCatalog(
    input: {
      key: string;
      label: string;
      type: string;
      options: string[];
      profileKey?: string;
    },
    actorUserId: string,
  ) {
    return db.transaction(async (transaction) => {
      const [field] = await transaction
        .insert(registrationFieldCatalog)
        .values({ ...input, createdByUserId: actorUserId })
        .returning();
      await transaction
        .insert(auditLogs)
        .values({
          actorUserId,
          action: "registration_field_catalog.created",
          entityType: "registration_field_catalog",
          entityId: field.id,
        });
      return field;
    });
  },
  listOpenFlows: (institutionId: string) =>
    db
      .select({
        id: registrationFlows.id,
        name: registrationFlows.name,
        closesAt: registrationFlows.closesAt,
        publishedVersion: registrationFlows.publishedVersion,
        updatedAt: registrationFlows.updatedAt,
      })
      .from(registrationFlows)
      .where(
        and(
          eq(registrationFlows.institutionId, institutionId),
          eq(registrationFlows.status, "published"),
          gt(registrationFlows.closesAt, new Date()),
        ),
      )
      .orderBy(desc(registrationFlows.updatedAt)),
  findCatalogFields: (ids: string[]) =>
    db
      .select()
      .from(registrationFieldCatalog)
      .where(inArray(registrationFieldCatalog.id, ids)),
  async getFlow(institutionId: string, flowId: string) {
    const [flow] = await db
      .select()
      .from(registrationFlows)
      .where(
        and(
          eq(registrationFlows.id, flowId),
          eq(registrationFlows.institutionId, institutionId),
        ),
      )
      .limit(1);
    if (!flow) return null;
    const [version] = await db
      .select()
      .from(registrationFormVersions)
      .where(eq(registrationFormVersions.flowId, flow.id))
      .orderBy(desc(registrationFormVersions.version))
      .limit(1);
    const fields = version
      ? await db
          .select()
          .from(registrationFields)
          .where(eq(registrationFields.formVersionId, version.id))
          .orderBy(asc(registrationFields.sortOrder))
      : [];
    return { flow, version: version ?? null, fields };
  },
  async saveDraft(input: {
    institutionId: string;
    flowId: string | null;
    name: string;
    fields: RegistrationFieldSnapshot[];
    actorUserId: string;
  }) {
    return db.transaction(async (transaction) => {
      const flow = input.flowId
        ? (
            await transaction
              .select()
              .from(registrationFlows)
              .where(
                and(
                  eq(registrationFlows.id, input.flowId),
                  eq(registrationFlows.institutionId, input.institutionId),
                ),
              )
              .limit(1)
          )[0]
        : (
            await transaction
              .insert(registrationFlows)
              .values({ institutionId: input.institutionId, name: input.name })
              .returning()
          )[0];
      if (!flow) return null;
      const [latestVersion] = await transaction
        .select()
        .from(registrationFormVersions)
        .where(eq(registrationFormVersions.flowId, flow.id))
        .orderBy(desc(registrationFormVersions.version))
        .limit(1);
      const [version] = await transaction
        .insert(registrationFormVersions)
        .values({
          flowId: flow.id,
          version: (latestVersion?.version ?? 0) + 1,
          createdByUserId: input.actorUserId,
        })
        .returning();
      if (input.fields.length)
        await transaction
          .insert(registrationFields)
          .values(
            input.fields.map((field) => ({
              ...field,
              formVersionId: version.id,
            })),
          );
      await transaction
        .update(registrationFlows)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(registrationFlows.id, flow.id));
      await transaction
        .insert(auditLogs)
        .values({
          actorUserId: input.actorUserId,
          institutionId: input.institutionId,
          action: "registration_flow.draft_saved",
          entityType: "registration_form_version",
          entityId: version.id,
        });
      return {
        flow: { id: flow.id, name: input.name },
        version: version.version,
      };
    });
  },
  async findPublishableVersion(
    institutionId: string,
    flowId: string,
    versionNumber: number,
  ) {
    const [flow] = await db
      .select()
      .from(registrationFlows)
      .where(
        and(
          eq(registrationFlows.id, flowId),
          eq(registrationFlows.institutionId, institutionId),
        ),
      )
      .limit(1);
    if (!flow) return null;
    const [version] = await db
      .select()
      .from(registrationFormVersions)
      .where(
        and(
          eq(registrationFormVersions.flowId, flow.id),
          eq(registrationFormVersions.version, versionNumber),
        ),
      )
      .limit(1);
    if (!version) return { flow, version: null, hasFields: false };
    const [field] = await db
      .select({ id: registrationFields.id })
      .from(registrationFields)
      .where(eq(registrationFields.formVersionId, version.id))
      .limit(1);
    return { flow, version, hasFields: Boolean(field) };
  },
  async publish(
    flowId: string,
    version: number,
    closesAt: Date,
    actorUserId: string,
    institutionId: string,
  ) {
    const [formVersion] = await db
      .select({ id: registrationFormVersions.id })
      .from(registrationFormVersions)
      .where(
        and(
          eq(registrationFormVersions.flowId, flowId),
          eq(registrationFormVersions.version, version),
        ),
      )
      .limit(1);
    await db
      .update(registrationFlows)
      .set({
        status: "published",
        publishedVersion: version,
        closesAt,
        updatedAt: new Date(),
      })
      .where(eq(registrationFlows.id, flowId));
    await db
      .insert(auditLogs)
      .values({
        actorUserId,
        institutionId,
        action: "registration_flow.published",
        entityType: "registration_form_version",
        entityId: formVersion!.id,
      });
  },
  async close(institutionId: string, flowId: string, actorUserId: string) {
    const [flow] = await db
      .select()
      .from(registrationFlows)
      .where(
        and(
          eq(registrationFlows.id, flowId),
          eq(registrationFlows.institutionId, institutionId),
        ),
      )
      .limit(1);
    if (!flow) return false;
    await db
      .update(registrationFlows)
      .set({ status: "closed", closesAt: new Date(), updatedAt: new Date() })
      .where(eq(registrationFlows.id, flow.id));
    await db
      .insert(auditLogs)
      .values({
        actorUserId,
        institutionId,
        action: "registration_flow.closed",
        entityType: "registration_flow",
        entityId: flow.id,
      });
    return true;
  },
  async findLatestOpenForm(institutionId: string) {
    const [flow] = await db
      .select()
      .from(registrationFlows)
      .where(
        and(
          eq(registrationFlows.institutionId, institutionId),
          eq(registrationFlows.status, "published"),
          gt(registrationFlows.closesAt, new Date()),
        ),
      )
      .orderBy(desc(registrationFlows.updatedAt))
      .limit(1);
    if (!flow?.publishedVersion || !flow.closesAt) return null;
    const [version] = await db
      .select()
      .from(registrationFormVersions)
      .where(
        and(
          eq(registrationFormVersions.flowId, flow.id),
          eq(registrationFormVersions.version, flow.publishedVersion),
        ),
      )
      .limit(1);
    if (!version) return null;
    const fields = await db
      .select()
      .from(registrationFields)
      .where(eq(registrationFields.formVersionId, version.id))
      .orderBy(asc(registrationFields.sortOrder));
    return { flow, version, fields };
  },
  async createSubmission(input: {
    institutionId: string;
    userId?: string;
    formVersionId: string;
    answers: Array<{
      fieldId: string;
      value: string | number | boolean | string[] | null;
    }>;
    profileChanges: Partial<typeof users.$inferInsert>;
  }) {
    return db.transaction(async (transaction) => {
      const [registration] = await transaction
        .insert(registrations)
        .values({
          institutionId: input.institutionId,
          userId: input.userId,
          formVersionId: input.formVersionId,
        })
        .returning();
      if (input.answers.length)
        await transaction
          .insert(registrationAnswers)
          .values(
            input.answers.map((answer) => ({
              registrationId: registration.id,
              ...answer,
            })),
          );
      if (input.userId && Object.keys(input.profileChanges).length)
        await transaction
          .update(users)
          .set({ ...input.profileChanges, updatedAt: new Date() })
          .where(eq(users.id, input.userId));
      return registration;
    });
  },
};
