import type { RequestHandler } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  registrationAnswers,
  registrationFields,
  registrationFlows,
  registrationFormVersions,
  registrations,
  users,
} from '../../db/Schemes/index.js';
import { HttpError } from '../../lib/http-error.js';

type AnswerValue = string | number | boolean | string[] | null;

const isAnswerValue = (value: unknown): value is AnswerValue =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || (Array.isArray(value) && value.every((item) => typeof item === 'string'));

const requiredInstitutionId = (value: string | string[] | undefined): string => {
  if (!value || Array.isArray(value)) throw new HttpError(400, 'institutionId is required.');
  return value;
};

const isEmptyRequiredValue = (value: AnswerValue | undefined): boolean =>
  value === undefined || value === null || value === '' || value === false || (Array.isArray(value) && value.length === 0);

const validateAnswer = (field: { key: string; label: string; type: string; options: string[]; required: boolean }, value: AnswerValue | undefined): void => {
  if (field.required && isEmptyRequiredValue(value)) throw new HttpError(400, `${field.label} is required.`);
  if (value === undefined || value === null || value === '') return;
  if (field.type === 'checkbox' && typeof value !== 'boolean') throw new HttpError(400, `${field.label} must be a checkbox value.`);
  if (field.type === 'select' && (typeof value !== 'string' || !field.options.includes(value))) throw new HttpError(400, `${field.label} contains an invalid option.`);
  if (field.type !== 'checkbox' && typeof value !== 'string' && typeof value !== 'number') throw new HttpError(400, `${field.label} has an invalid value.`);
};

export const submitRegistration: RequestHandler = async (request, response, next) => {
  try {
    const institutionId = requiredInstitutionId(request.params['institutionId']);
    const body = request.body as Record<string, unknown>;
    const rawAnswers = body?.['answers'];
    if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) throw new HttpError(400, 'answers must be an object.');
    const answers = rawAnswers as Record<string, unknown>;
    const [flow] = await db.select().from(registrationFlows).where(eq(registrationFlows.institutionId, institutionId)).limit(1);
    if (!flow || flow.status !== 'published' || !flow.publishedVersion || !flow.closesAt || flow.closesAt <= new Date()) throw new HttpError(409, 'Registration is not currently open.');
    const [version] = await db.select().from(registrationFormVersions).where(
      and(eq(registrationFormVersions.flowId, flow.id), eq(registrationFormVersions.version, flow.publishedVersion)),
    ).limit(1);
    if (!version) throw new HttpError(409, 'The published form is unavailable.');
    const fields = await db.select().from(registrationFields).where(eq(registrationFields.formVersionId, version.id)).orderBy(asc(registrationFields.sortOrder));
    const answerEntries = Object.entries(answers);
    if (answerEntries.some(([, value]) => !isAnswerValue(value))) throw new HttpError(400, 'An answer contains an unsupported value.');
    for (const field of fields) validateAnswer(field, answers[field.key] as AnswerValue | undefined);

    const registration = await db.transaction(async (transaction) => {
      const [created] = await transaction.insert(registrations).values({
        institutionId,
        userId: request.auth?.user.id,
        formVersionId: version.id,
      }).returning();
      const answersToSave = fields.flatMap((field) => {
        const value = answers[field.key];
        return value === undefined ? [] : [{ registrationId: created.id, fieldId: field.id, value: value as AnswerValue }];
      });
      if (answersToSave.length) await transaction.insert(registrationAnswers).values(answersToSave);

      const profileChanges: Partial<typeof users.$inferInsert> = {};
      for (const field of fields) {
        const value = answers[field.key];
        if (field.profileKey && typeof value === 'string' && value.trim()) {
          if (field.profileKey === 'firstName') profileChanges.firstName = value.trim();
          if (field.profileKey === 'lastName') profileChanges.lastName = value.trim();
          if (field.profileKey === 'phone') profileChanges.phone = value.trim();
          if (field.profileKey === 'idNumber') profileChanges.idNumber = value.trim();
        }
      }
      if (request.auth && Object.keys(profileChanges).length) await transaction.update(users).set({ ...profileChanges, updatedAt: new Date() }).where(eq(users.id, request.auth.user.id));
      return created;
    });
    response.status(201).json(registration);
  } catch (error) {
    next(error);
  }
};
