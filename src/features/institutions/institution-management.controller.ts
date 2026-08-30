import type { RequestHandler } from 'express';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  auditLogs,
  institutionMemberships,
  institutions,
  registrationFields,
  registrationFlows,
  registrationFormVersions,
  registrations,
  users,
} from '../../db/schema.js';
import { HttpError } from '../../lib/http-error.js';

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'A JSON object is required.');
  return value as Record<string, unknown>;
};

const requiredString = (body: Record<string, unknown>, key: string): string => {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${key} is required.`);
  return value.trim();
};

const optionalString = (body: Record<string, unknown>, key: string): string | undefined => {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${key} must be a string.`);
  return value.trim();
};

const requiredInstitutionId = (value: string | string[] | undefined): string => {
  if (!value || Array.isArray(value)) throw new HttpError(400, 'institutionId is required.');
  return value;
};

const writeAuditLog = (actorUserId: string, action: string, entityType: string, entityId: string, institutionId?: string) =>
  db.insert(auditLogs).values({ actorUserId, action, entityType, entityId, institutionId });

export const listAdminInstitutions: RequestHandler = async (_request, response, next) => {
  try {
    response.status(200).json(await db.select().from(institutions).orderBy(asc(institutions.name)));
  } catch (error) {
    next(error);
  }
};

export const createInstitution: RequestHandler = async (request, response, next) => {
  try {
    const body = asRecord(request.body);
    const institution = await db.transaction(async (transaction) => {
      const [created] = await transaction.insert(institutions).values({
        name: requiredString(body, 'name'),
        logoUrl: requiredString(body, 'logoUrl'),
        address: requiredString(body, 'address'),
        city: requiredString(body, 'city'),
      }).returning();
      await transaction.insert(registrationFlows).values({ institutionId: created.id, name: 'טופס הרשמה' });
      await transaction.insert(auditLogs).values({
        actorUserId: request.auth!.user.id,
        institutionId: created.id,
        action: 'institution.created',
        entityType: 'institution',
        entityId: created.id,
      });
      return created;
    });
    response.status(201).json(institution);
  } catch (error) {
    next(error);
  }
};

export const assignInstitutionMember: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const body = asRecord(request.body);
    const email = requiredString(body, 'email').toLowerCase();
    const role = requiredString(body, 'role');
    if (role !== 'manager' && role !== 'secretary') throw new HttpError(400, 'role must be manager or secretary.');
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new HttpError(404, 'A user with this email was not found.');
    await db.insert(institutionMemberships).values({ institutionId, userId: user.id, role }).onConflictDoUpdate({
      target: [institutionMemberships.userId, institutionMemberships.institutionId],
      set: { role },
    });
    await writeAuditLog(request.auth!.user.id, 'institution.member_assigned', 'institution_membership', user.id, institutionId);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getInstitutionAnalytics: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const byStatus = await db.select({ status: registrations.status, total: count() })
      .from(registrations)
      .where(eq(registrations.institutionId, institutionId))
      .groupBy(registrations.status);
    const [total] = await db.select({ total: count() }).from(registrations).where(eq(registrations.institutionId, institutionId));
    response.status(200).json({ institutionId, totalRegistrations: total.total, byStatus });
  } catch (error) {
    next(error);
  }
};

export const getRegistrationFlow: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const [flow] = await db.select().from(registrationFlows).where(eq(registrationFlows.institutionId, institutionId)).limit(1);
    if (!flow) throw new HttpError(404, 'Registration flow was not found.');
    const [version] = await db.select().from(registrationFormVersions)
      .where(eq(registrationFormVersions.flowId, flow.id))
      .orderBy(desc(registrationFormVersions.version)).limit(1);
    const fields = version
      ? await db.select().from(registrationFields).where(eq(registrationFields.formVersionId, version.id)).orderBy(asc(registrationFields.sortOrder))
      : [];
    response.status(200).json({ flow, version: version ?? null, fields });
  } catch (error) {
    next(error);
  }
};
