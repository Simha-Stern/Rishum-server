import type { RequestHandler } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  auditLogs,
  registrationFields,
  registrationFlows,
  registrationFormVersions,
} from '../../db/Schemes/index.js';
import { HttpError } from '../../lib/http-error.js';

type FieldInput = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  profileKey?: string;
};

const allowedTypes = new Set(['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'checkbox']);
const allowedProfileKeys = new Set(['firstName', 'lastName', 'phone', 'idNumber']);

const requiredInstitutionId = (value: string | string[] | undefined): string => {
  if (!value || Array.isArray(value)) throw new HttpError(400, 'institutionId is required.');
  return value;
};

const parseFields = (value: unknown): FieldInput[] => {
  if (!Array.isArray(value)) throw new HttpError(400, 'fields must be an array.');
  const keys = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, `fields[${index}] must be an object.`);
    const field = item as Record<string, unknown>;
    const key = typeof field['key'] === 'string' ? field['key'].trim() : '';
    const label = typeof field['label'] === 'string' ? field['label'].trim() : '';
    const type = typeof field['type'] === 'string' ? field['type'] : '';
    const profileKey = typeof field['profileKey'] === 'string' ? field['profileKey'] : undefined;
    const options = field['options'] === undefined ? [] : field['options'];
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || keys.has(key)) throw new HttpError(400, 'Every field key must be unique and use letters, numbers, and underscores.');
    if (!label || !allowedTypes.has(type)) throw new HttpError(400, `fields[${index}] has an invalid label or type.`);
    if (!Array.isArray(options) || options.some((option) => typeof option !== 'string')) throw new HttpError(400, `fields[${index}].options must be an array of strings.`);
    if (profileKey && !allowedProfileKeys.has(profileKey)) throw new HttpError(400, 'profileKey is not supported.');
    const normalizedOptions = [...new Set(options.map((option) => option.trim()).filter(Boolean))];
    if (type === 'select' && normalizedOptions.length === 0) throw new HttpError(400, `fields[${index}] must include at least one option.`);
    if (type !== 'select' && normalizedOptions.length > 0) throw new HttpError(400, `fields[${index}].options are supported only for select fields.`);
    keys.add(key);
    return { key, label, type, required: field['required'] === true, options: normalizedOptions, ...(profileKey ? { profileKey } : {}) };
  });
};

export const saveRegistrationFlowDraft: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const rawBody = request.body;
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) throw new HttpError(400, 'A JSON object is required.');
    const body = rawBody as Record<string, unknown>;
    const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
    if (!name) throw new HttpError(400, 'name is required.');
    const fields = parseFields(body['fields']);

    const result = await db.transaction(async (transaction) => {
      const [flow] = await transaction.select().from(registrationFlows).where(eq(registrationFlows.institutionId, institutionId)).limit(1);
      if (!flow) throw new HttpError(404, 'Registration flow was not found.');
      const [latestVersion] = await transaction.select().from(registrationFormVersions)
        .where(eq(registrationFormVersions.flowId, flow.id))
        .orderBy(desc(registrationFormVersions.version)).limit(1);
      const versionNumber = (latestVersion?.version ?? 0) + 1;
      const [version] = await transaction.insert(registrationFormVersions).values({
        flowId: flow.id,
        version: versionNumber,
        createdByUserId: request.auth!.user.id,
      }).returning();
      if (fields.length) {
        await transaction.insert(registrationFields).values(fields.map((field, sortOrder) => ({
          ...field,
          formVersionId: version.id,
          sortOrder,
        })));
      }
      await transaction.update(registrationFlows).set({ name, updatedAt: new Date() }).where(eq(registrationFlows.id, flow.id));
      await transaction.insert(auditLogs).values({
        actorUserId: request.auth!.user.id,
        institutionId,
        action: 'registration_flow.draft_saved',
        entityType: 'registration_form_version',
        entityId: version.id,
      });
      return version;
    });
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const publishRegistrationFlow: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const body = request.body as Record<string, unknown>;
    const version = body && typeof body['version'] === 'number' ? body['version'] : null;
    const closesAtValue = body && typeof body['closesAt'] === 'string' ? body['closesAt'] : '';
    const closesAt = new Date(closesAtValue);
    if (!version || !Number.isInteger(version)) throw new HttpError(400, 'A valid version number is required.');
    if (Number.isNaN(closesAt.getTime()) || closesAt <= new Date()) throw new HttpError(400, 'A future registration closing date is required.');
    const [flow] = await db.select().from(registrationFlows).where(eq(registrationFlows.institutionId, institutionId)).limit(1);
    if (!flow) throw new HttpError(404, 'Registration flow was not found.');
    const [formVersion] = await db.select({ id: registrationFormVersions.id }).from(registrationFormVersions).where(
      and(eq(registrationFormVersions.flowId, flow.id), eq(registrationFormVersions.version, version)),
    ).limit(1);
    if (!formVersion) throw new HttpError(404, 'Registration form version was not found.');
    const [field] = await db.select({ id: registrationFields.id }).from(registrationFields)
      .where(eq(registrationFields.formVersionId, formVersion.id)).limit(1);
    if (!field) throw new HttpError(400, 'At least one registration field is required before publishing.');
    await db.update(registrationFlows).set({ status: 'published', publishedVersion: version, closesAt, updatedAt: new Date() }).where(eq(registrationFlows.id, flow.id));
    await db.insert(auditLogs).values({
      actorUserId: request.auth!.user.id,
      institutionId,
      action: 'registration_flow.published',
      entityType: 'registration_form_version',
      entityId: formVersion.id,
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const closeRegistrationFlow: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const [flow] = await db.select().from(registrationFlows).where(eq(registrationFlows.institutionId, institutionId)).limit(1);
    if (!flow) throw new HttpError(404, 'Registration flow was not found.');
    await db.update(registrationFlows).set({ status: 'closed', closesAt: new Date(), updatedAt: new Date() }).where(eq(registrationFlows.id, flow.id));
    await db.insert(auditLogs).values({
      actorUserId: request.auth!.user.id,
      institutionId,
      action: 'registration_flow.closed',
      entityType: 'registration_flow',
      entityId: flow.id,
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getPublicRegistrationForm: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const [flow] = await db.select().from(registrationFlows).where(eq(registrationFlows.institutionId, institutionId)).limit(1);
    if (!flow || flow.status !== 'published' || !flow.publishedVersion || !flow.closesAt || flow.closesAt <= new Date()) throw new HttpError(404, 'Registration is not currently open.');
    const [version] = await db.select().from(registrationFormVersions).where(
      and(eq(registrationFormVersions.flowId, flow.id), eq(registrationFormVersions.version, flow.publishedVersion)),
    ).limit(1);
    if (!version) throw new HttpError(404, 'Published registration form was not found.');
    const fields = await db.select().from(registrationFields).where(eq(registrationFields.formVersionId, version.id)).orderBy(asc(registrationFields.sortOrder));
    response.status(200).json({ institutionId, flow: { name: flow.name, version: version.version, closesAt: flow.closesAt }, fields });
  } catch (error) {
    next(error);
  }
};
