import { HttpError } from "../../lib/http-error.js";
import type { InstitutionRole } from "../auth/auth.types.js";
import { institutionsDal } from "./institutions.dal.js";

type InstitutionDetails = {
  name: string;
  logoUrl: string;
  address: string;
  city: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "A JSON object is required.");
  return value as Record<string, unknown>;
};

const requiredString = (body: Record<string, unknown>, key: string): string => {
  const value = body[key];
  if (typeof value !== "string" || !value.trim())
    throw new HttpError(400, `${key} is required.`);
  return value.trim();
};

const optionalEmail = (
  body: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = body[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string")
    throw new HttpError(400, `${key} must be a string.`);
  const email = value.trim().toLowerCase();
  if (!emailPattern.test(email))
    throw new HttpError(400, `${key} must be a valid email address.`);
  return email;
};

const requiredEmail = (body: Record<string, unknown>, key: string): string => {
  const email = optionalEmail(body, key);
  if (!email) throw new HttpError(400, `${key} is required.`);
  return email;
};

const parseInstitutionDetails = (input: unknown): InstitutionDetails => {
  const body = asRecord(input);
  return {
    name: requiredString(body, "name"),
    logoUrl: requiredString(body, "logoUrl"),
    address: requiredString(body, "address"),
    city: requiredString(body, "city"),
  };
};

const parseInstitutionId = (value: string | string[] | undefined): string => {
  if (!value || Array.isArray(value))
    throw new HttpError(400, "institutionId is required.");
  return value;
};

const parseEmailParam = (value: string | string[] | undefined): string => {
  if (!value || Array.isArray(value))
    throw new HttpError(400, "email is required.");
  const email = value.trim().toLowerCase();
  if (!emailPattern.test(email))
    throw new HttpError(400, "email must be a valid email address.");
  return email;
};

const parseRole = (value: unknown): InstitutionRole => {
  if (value !== "manager" && value !== "secretary")
    throw new HttpError(400, "role must be manager or secretary.");
  return value;
};

const assignmentId = (
  assignment:
    | { status: "active"; userId: string }
    | { status: "pending"; invitationId: string },
) =>
  assignment.status === "active" ? assignment.userId : assignment.invitationId;

export const institutionsService = {
  list: () => institutionsDal.findAll(),
  listAdminInstitutions: () => institutionsDal.listAdminInstitutions(),

  async createInstitution(input: unknown, actorUserId: string) {
    const body = asRecord(input);
    const managerEmail = requiredEmail(body, "managerEmail");
    const secretaryEmail = optionalEmail(body, "secretaryEmail");
    if (managerEmail === secretaryEmail)
      throw new HttpError(
        400,
        "Manager and secretary emails must be different.",
      );
    return institutionsDal.createInstitution({
      ...parseInstitutionDetails(body),
      managerEmail,
      secretaryEmail,
      actorUserId,
      registrationFlowName: "טופס הרשמה",
    });
  },

  async updateInstitution(
    institutionId: string | string[] | undefined,
    input: unknown,
    actorUserId: string,
  ) {
    const id = parseInstitutionId(institutionId);
    const body = asRecord(input);
    const managerEmail = optionalEmail(body, "managerEmail");
    const secretaryEmail = optionalEmail(body, "secretaryEmail");
    if (managerEmail && secretaryEmail && managerEmail === secretaryEmail) {
      throw new HttpError(
        400,
        "Manager and secretary emails must be different.",
      );
    }
    const institution = await institutionsDal.updateInstitution(
      id,
      parseInstitutionDetails(body),
      actorUserId,
    );
    if (!institution) throw new HttpError(404, "Institution was not found.");
    if (managerEmail)
      await institutionsDal.grantOrInviteMember(
        id,
        managerEmail,
        "manager",
        actorUserId,
      );
    if (secretaryEmail)
      await institutionsDal.grantOrInviteMember(
        id,
        secretaryEmail,
        "secretary",
        actorUserId,
      );
    return institution;
  },

  async deleteInstitution(institutionId: string | string[] | undefined) {
    const [institution] = await institutionsDal.deleteInstitution(
      parseInstitutionId(institutionId),
    );
    if (!institution) throw new HttpError(404, "Institution was not found.");
  },

  async assignInstitutionMember(
    institutionId: string | string[] | undefined,
    input: unknown,
    actorUserId: string,
  ) {
    const body = asRecord(input);
    const role = parseRole(requiredString(body, "role"));
    const id = parseInstitutionId(institutionId);
    const assignment = await institutionsDal.grantOrInviteMember(
      id,
      requiredEmail(body, "email"),
      role,
      actorUserId,
    );
    await institutionsDal.writeMemberAuditLog(
      actorUserId,
      "institution.member_assigned",
      assignmentId(assignment),
      id,
    );
    return assignment;
  },

  listInstitutionTeam: (institutionId: string | string[] | undefined) =>
    institutionsDal.listInstitutionTeam(parseInstitutionId(institutionId)),

  async inviteInstitutionSecretary(
    institutionId: string | string[] | undefined,
    input: unknown,
    actorUserId: string,
  ) {
    const id = parseInstitutionId(institutionId);
    const body = asRecord(input);
    const role =
      body["role"] === undefined ? "secretary" : parseRole(body["role"]);
    const assignment = await institutionsDal.grantOrInviteMember(
      id,
      requiredEmail(body, "email"),
      role,
      actorUserId,
    );
    await institutionsDal.writeMemberAuditLog(
      actorUserId,
      "institution.member_invited",
      assignmentId(assignment),
      id,
    );
    return assignment;
  },

  async updateInstitutionTeamMember(
    institutionId: string | string[] | undefined,
    email: string | string[] | undefined,
    input: unknown,
    actorUserId: string,
  ) {
    const id = parseInstitutionId(institutionId);
    const normalizedEmail = parseEmailParam(email);
    const role = parseRole(requiredString(asRecord(input), "role"));
    const member = await institutionsDal.findTeamMemberByEmail(
      id,
      normalizedEmail,
    );
    if (!member)
      throw new HttpError(404, "Institution team member was not found.");
    if (
      member.status === "active" &&
      member.role === "manager" &&
      role !== "manager" &&
      (await institutionsDal.countActiveManagers(id)) <= 1
    ) {
      throw new HttpError(
        409,
        "At least one active institution manager is required.",
      );
    }
    await institutionsDal.updateTeamMemberRole(
      id,
      normalizedEmail,
      role,
      member,
    );
    await institutionsDal.writeMemberAuditLog(
      actorUserId,
      "institution.member_role_updated",
      member.entityId,
      id,
    );
  },

  async removeInstitutionTeamMember(
    institutionId: string | string[] | undefined,
    email: string | string[] | undefined,
    actorUserId: string,
  ) {
    const id = parseInstitutionId(institutionId);
    const normalizedEmail = parseEmailParam(email);
    const member = await institutionsDal.findTeamMemberByEmail(
      id,
      normalizedEmail,
    );
    if (!member)
      throw new HttpError(404, "Institution team member was not found.");
    if (
      member.status === "active" &&
      member.role === "manager" &&
      (await institutionsDal.countActiveManagers(id)) <= 1
    ) {
      throw new HttpError(
        409,
        "At least one active institution manager is required.",
      );
    }
    await institutionsDal.removeTeamMember(id, normalizedEmail, member);
    await institutionsDal.writeMemberAuditLog(
      actorUserId,
      "institution.member_removed",
      member.entityId,
      id,
    );
  },

  getInstitutionAnalytics: (institutionId: string | string[] | undefined) =>
    institutionsDal.getInstitutionAnalytics(parseInstitutionId(institutionId)),
};
