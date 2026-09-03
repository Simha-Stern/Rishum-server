import { HttpError } from "../../lib/http-error.js";
import { registrationsDal } from "./registrations.dal.js";

type AnswerValue = string | number | boolean | string[] | null;
type FieldSelection = { catalogFieldId: string; required: boolean };
type CatalogFieldInput = {
  key: string;
  label: string;
  type: string;
  options: string[];
  profileKey?: string;
};

const fieldTypes = new Set([
  "text",
  "email",
  "tel",
  "number",
  "date",
  "textarea",
  "select",
  "checkbox",
]);
const profileKeys = new Set(["firstName", "lastName", "phone", "idNumber"]);
const requiredParam = (
  value: string | string[] | undefined,
  name: string,
): string => {
  if (!value || Array.isArray(value))
    throw new HttpError(400, `${name} is required.`);
  return value;
};
const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "A JSON object is required.");
  return value as Record<string, unknown>;
};
const isAnswerValue = (value: unknown): value is AnswerValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));
const isEmpty = (value: AnswerValue | undefined): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  value === false ||
  (Array.isArray(value) && value.length === 0);

const parseCatalogField = (input: unknown): CatalogFieldInput => {
  const value = asRecord(input);
  const key = typeof value["key"] === "string" ? value["key"].trim() : "";
  const label = typeof value["label"] === "string" ? value["label"].trim() : "";
  const type = typeof value["type"] === "string" ? value["type"] : "";
  const profileKey =
    typeof value["profileKey"] === "string" ? value["profileKey"] : undefined;
  const rawOptions = value["options"] === undefined ? [] : value["options"];
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key))
    throw new HttpError(400, "key must use letters, numbers, and underscores.");
  if (!label || !fieldTypes.has(type))
    throw new HttpError(400, "A valid label and field type are required.");
  if (
    !Array.isArray(rawOptions) ||
    rawOptions.some((option) => typeof option !== "string")
  )
    throw new HttpError(400, "options must be an array of strings.");
  if (profileKey && !profileKeys.has(profileKey))
    throw new HttpError(400, "profileKey is not supported.");
  const options = [
    ...new Set(rawOptions.map((option) => option.trim()).filter(Boolean)),
  ];
  if (type === "select" && options.length === 0)
    throw new HttpError(400, "Select fields require at least one option.");
  if (type !== "select" && options.length > 0)
    throw new HttpError(400, "Options are supported only for select fields.");
  return { key, label, type, options, ...(profileKey ? { profileKey } : {}) };
};

const parseDraft = (value: unknown) => {
  const body = asRecord(value);
  const name = typeof body["name"] === "string" ? body["name"].trim() : "";
  if (!name) throw new HttpError(400, "name is required.");
  if (!Array.isArray(body["selectedFields"]))
    throw new HttpError(400, "selectedFields must be an array.");
  const ids = new Set<string>();
  const selectedFields = body["selectedFields"].map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new HttpError(400, `selectedFields[${index}] must be an object.`);
    const field = item as Record<string, unknown>;
    const catalogFieldId =
      typeof field["catalogFieldId"] === "string"
        ? field["catalogFieldId"].trim()
        : "";
    if (!catalogFieldId || ids.has(catalogFieldId))
      throw new HttpError(400, "Every selected catalog field must be unique.");
    ids.add(catalogFieldId);
    return {
      catalogFieldId,
      required: field["required"] === true,
    } satisfies FieldSelection;
  });
  return { name, selectedFields };
};

const validateAnswer = (
  field: {
    key: string;
    label: string;
    type: string;
    options: string[];
    required: boolean;
  },
  value: AnswerValue | undefined,
): void => {
  if (field.required && isEmpty(value))
    throw new HttpError(400, `${field.label} is required.`);
  if (value === undefined || value === null || value === "") return;
  if (field.type === "checkbox" && typeof value !== "boolean")
    throw new HttpError(400, `${field.label} must be a checkbox value.`);
  if (
    field.type === "select" &&
    (typeof value !== "string" || !field.options.includes(value))
  )
    throw new HttpError(400, `${field.label} contains an invalid option.`);
  if (
    field.type !== "checkbox" &&
    typeof value !== "string" &&
    typeof value !== "number"
  )
    throw new HttpError(400, `${field.label} has an invalid value.`);
};

export const registrationsService = {
  listCatalog: () => registrationsDal.listCatalog(),
  async createCatalog(input: unknown, actorUserId: string) {
    const field = parseCatalogField(input);
    if (await registrationsDal.findCatalogByKey(field.key))
      throw new HttpError(409, "A catalog field with this key already exists.");
    return registrationsDal.createCatalog(field, actorUserId);
  },
  listOpenFlows: (institutionId: string | string[] | undefined) =>
    registrationsDal.listOpenFlows(
      requiredParam(institutionId, "institutionId"),
    ),
  async getFlow(
    institutionId: string | string[] | undefined,
    flowId: string | string[] | undefined,
  ) {
    const flow = await registrationsDal.getFlow(
      requiredParam(institutionId, "institutionId"),
      requiredParam(flowId, "flowId"),
    );
    if (!flow) throw new HttpError(404, "Registration flow was not found.");
    return flow;
  },
  async saveDraft(
    institutionParam: string | string[] | undefined,
    flowParam: string | string[] | undefined | null,
    body: unknown,
    actorUserId: string,
  ) {
    const institutionId = requiredParam(institutionParam, "institutionId");
    const flowId =
      flowParam === null ? null : requiredParam(flowParam, "flowId");
    const { name, selectedFields } = parseDraft(body);
    const catalogFields = await registrationsDal.findCatalogFields(
      selectedFields.map((field) => field.catalogFieldId),
    );
    if (catalogFields.length !== selectedFields.length)
      throw new HttpError(400, "One or more selected fields are unavailable.");
    const byId = new Map(catalogFields.map((field) => [field.id, field]));
    const keys = new Set<string>();
    const fields = selectedFields.map((selection, sortOrder) => {
      const field = byId.get(selection.catalogFieldId)!;
      if (keys.has(field.key))
        throw new HttpError(400, "Selected fields must use unique keys.");
      keys.add(field.key);
      return {
        catalogFieldId: field.id,
        key: field.key,
        label: field.label,
        type: field.type,
        required: selection.required,
        options: field.options,
        profileKey: field.profileKey,
        sortOrder,
      };
    });
    const saved = await registrationsDal.saveDraft({
      institutionId,
      flowId,
      name,
      fields,
      actorUserId,
    });
    if (!saved) throw new HttpError(404, "Registration flow was not found.");
    return saved;
  },
  async publish(
    institutionParam: string | string[] | undefined,
    flowParam: string | string[] | undefined,
    body: unknown,
    actorUserId: string,
  ) {
    const institutionId = requiredParam(institutionParam, "institutionId");
    const flowId = requiredParam(flowParam, "flowId");
    const input =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const version =
      typeof input["version"] === "number" ? input["version"] : null;
    const closesAt = new Date(
      typeof input["closesAt"] === "string" ? input["closesAt"] : "",
    );
    if (!version || !Number.isInteger(version))
      throw new HttpError(400, "A valid version number is required.");
    if (Number.isNaN(closesAt.getTime()) || closesAt <= new Date())
      throw new HttpError(
        400,
        "A future registration closing date is required.",
      );
    const publication = await registrationsDal.findPublishableVersion(
      institutionId,
      flowId,
      version,
    );
    if (!publication)
      throw new HttpError(404, "Registration flow was not found.");
    if (!publication.version)
      throw new HttpError(404, "Registration form version was not found.");
    if (!publication.hasFields)
      throw new HttpError(
        400,
        "At least one registration field is required before publishing.",
      );
    await registrationsDal.publish(
      flowId,
      version,
      closesAt,
      actorUserId,
      institutionId,
    );
  },
  async close(
    institutionParam: string | string[] | undefined,
    flowParam: string | string[] | undefined,
    actorUserId: string,
  ) {
    if (
      !(await registrationsDal.close(
        requiredParam(institutionParam, "institutionId"),
        requiredParam(flowParam, "flowId"),
        actorUserId,
      ))
    )
      throw new HttpError(404, "Registration flow was not found.");
  },
  async getPublicForm(institutionParam: string | string[] | undefined) {
    const institutionId = requiredParam(institutionParam, "institutionId");
    const form = await registrationsDal.findLatestOpenForm(institutionId);
    if (!form) throw new HttpError(404, "Registration is not currently open.");
    return {
      institutionId,
      flow: {
        id: form.flow.id,
        name: form.flow.name,
        version: form.version.version,
        closesAt: form.flow.closesAt!,
      },
      fields: form.fields,
    };
  },
  async submit(
    institutionParam: string | string[] | undefined,
    body: unknown,
    userId?: string,
  ) {
    const institutionId = requiredParam(institutionParam, "institutionId");
    const rawAnswers =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)["answers"]
        : undefined;
    if (
      !rawAnswers ||
      typeof rawAnswers !== "object" ||
      Array.isArray(rawAnswers)
    )
      throw new HttpError(400, "answers must be an object.");
    const answers = rawAnswers as Record<string, unknown>;
    if (Object.values(answers).some((value) => !isAnswerValue(value)))
      throw new HttpError(400, "An answer contains an unsupported value.");
    const form = await registrationsDal.findLatestOpenForm(institutionId);
    if (!form) throw new HttpError(409, "Registration is not currently open.");
    for (const field of form.fields)
      validateAnswer(field, answers[field.key] as AnswerValue | undefined);
    const profileChanges: Record<string, string> = {};
    for (const field of form.fields) {
      const value = answers[field.key];
      if (field.profileKey && typeof value === "string" && value.trim())
        profileChanges[field.profileKey] = value.trim();
    }
    const savedAnswers = form.fields.flatMap((field) =>
      answers[field.key] === undefined
        ? []
        : [{ fieldId: field.id, value: answers[field.key] as AnswerValue }],
    );
    return registrationsDal.createSubmission({
      institutionId,
      userId,
      formVersionId: form.version.id,
      answers: savedAnswers,
      profileChanges,
    });
  },
};
