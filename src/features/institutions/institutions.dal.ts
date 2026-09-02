import { and, asc, count, desc, eq, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  auditLogs,
  institutionInvitations,
  institutionMemberships,
  institutions,
  registrationFields,
  registrationFlows,
  registrationFormVersions,
  registrations,
  users,
} from '../../db/Schemes/index.js';
import type { InstitutionRole } from '../auth/auth.types.js';

type InstitutionDetails = { name: string; logoUrl: string; address: string; city: string };
type AccessAssignment = { status: 'active'; userId: string } | { status: 'pending'; invitationId: string };
type TeamMemberRecord = { status: 'active' | 'pending'; role: InstitutionRole; entityId: string };

const writeAuditLog = (actorUserId: string, action: string, entityType: string, entityId: string, institutionId?: string) =>
  db.insert(auditLogs).values({ actorUserId, action, entityType, entityId, institutionId });

export const institutionsDal = {
  findAll: () => db.select({
    id: institutions.id,
    name: institutions.name,
    logoUrl: institutions.logoUrl,
    address: institutions.address,
    city: institutions.city,
    createdAt: institutions.createdAt,
    updatedAt: institutions.updatedAt,
  }).from(institutions).innerJoin(registrationFlows, eq(registrationFlows.institutionId, institutions.id))
    .where(and(eq(registrationFlows.status, 'published'), gt(registrationFlows.closesAt, new Date())))
    .orderBy(asc(institutions.name)),

  listAdminInstitutions: () => db.select().from(institutions).orderBy(asc(institutions.name)),

  async createInstitution(input: InstitutionDetails & {
    managerEmail: string;
    secretaryEmail?: string;
    actorUserId: string;
    registrationFlowName: string;
  }) {
    return db.transaction(async (transaction) => {
      const { managerEmail, secretaryEmail, actorUserId, registrationFlowName, ...details } = input;
      const [created] = await transaction.insert(institutions).values(details).returning();
      await transaction.insert(registrationFlows).values({ institutionId: created.id, name: registrationFlowName });

      const grantOrInvite = async (email: string, role: InstitutionRole) => {
        const [user] = await transaction.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (user) {
          await transaction.insert(institutionMemberships).values({ institutionId: created.id, userId: user.id, role });
          return;
        }
        await transaction.insert(institutionInvitations).values({
          institutionId: created.id,
          invitedEmail: email,
          invitedByUserId: actorUserId,
          role,
        });
      };

      await grantOrInvite(managerEmail, 'manager');
      if (secretaryEmail) await grantOrInvite(secretaryEmail, 'secretary');
      await transaction.insert(auditLogs).values({
        actorUserId,
        institutionId: created.id,
        action: 'institution.created',
        entityType: 'institution',
        entityId: created.id,
      });
      return created;
    });
  },

  async updateInstitution(institutionId: string, input: InstitutionDetails, actorUserId: string) {
    const [institution] = await db.update(institutions).set({ ...input, updatedAt: new Date() })
      .where(eq(institutions.id, institutionId)).returning();
    if (institution) await writeAuditLog(actorUserId, 'institution.updated', 'institution', institutionId, institutionId);
    return institution;
  },

  deleteInstitution: (institutionId: string) =>
    db.delete(institutions).where(eq(institutions.id, institutionId)).returning({ id: institutions.id }),

  async grantOrInviteMember(institutionId: string, email: string, role: InstitutionRole, invitedByUserId: string): Promise<AccessAssignment> {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      await db.insert(institutionMemberships).values({ institutionId, userId: user.id, role }).onConflictDoUpdate({
        target: [institutionMemberships.userId, institutionMemberships.institutionId],
        set: { role },
      });
      return { status: 'active', userId: user.id };
    }
    const [invitation] = await db.insert(institutionInvitations).values({
      institutionId,
      invitedEmail: email,
      invitedByUserId,
      role,
    }).onConflictDoUpdate({
      target: [institutionInvitations.institutionId, institutionInvitations.invitedEmail],
      set: { role, invitedByUserId },
    }).returning({ id: institutionInvitations.id });
    return { status: 'pending', invitationId: invitation.id };
  },

  writeMemberAuditLog: (actorUserId: string, action: string, entityId: string, institutionId: string) =>
    writeAuditLog(actorUserId, action, 'institution_membership', entityId, institutionId),

  async findTeamMemberByEmail(institutionId: string, email: string): Promise<TeamMemberRecord | null> {
    const [activeMember] = await db.select({ entityId: users.id, role: institutionMemberships.role })
      .from(institutionMemberships)
      .innerJoin(users, eq(institutionMemberships.userId, users.id))
      .where(and(eq(institutionMemberships.institutionId, institutionId), eq(users.email, email)))
      .limit(1);
    if (activeMember) return { ...activeMember, status: 'active' };

    const [pendingMember] = await db.select({ entityId: institutionInvitations.id, role: institutionInvitations.role })
      .from(institutionInvitations)
      .where(and(eq(institutionInvitations.institutionId, institutionId), eq(institutionInvitations.invitedEmail, email)))
      .limit(1);
    return pendingMember ? { ...pendingMember, status: 'pending' } : null;
  },

  countActiveManagers: async (institutionId: string) => {
    const [result] = await db.select({ total: count() }).from(institutionMemberships)
      .where(and(eq(institutionMemberships.institutionId, institutionId), eq(institutionMemberships.role, 'manager')));
    return result.total;
  },

  async updateTeamMemberRole(institutionId: string, email: string, role: InstitutionRole, member: TeamMemberRecord): Promise<void> {
    if (member.status === 'active') {
      await db.update(institutionMemberships).set({ role }).where(and(
        eq(institutionMemberships.institutionId, institutionId),
        eq(institutionMemberships.userId, member.entityId),
      ));
      return;
    }
    await db.update(institutionInvitations).set({ role }).where(and(
      eq(institutionInvitations.institutionId, institutionId),
      eq(institutionInvitations.invitedEmail, email),
    ));
  },

  async removeTeamMember(institutionId: string, email: string, member: TeamMemberRecord): Promise<void> {
    if (member.status === 'active') {
      await db.delete(institutionMemberships).where(and(
        eq(institutionMemberships.institutionId, institutionId),
        eq(institutionMemberships.userId, member.entityId),
      ));
      return;
    }
    await db.delete(institutionInvitations).where(and(
      eq(institutionInvitations.institutionId, institutionId),
      eq(institutionInvitations.invitedEmail, email),
    ));
  },

  async listInstitutionTeam(institutionId: string) {
    const activeMembers = await db.select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: institutionMemberships.role,
      createdAt: institutionMemberships.createdAt,
    }).from(institutionMemberships).innerJoin(users, eq(institutionMemberships.userId, users.id))
      .where(eq(institutionMemberships.institutionId, institutionId));
    const pendingMembers = await db.select({
      email: institutionInvitations.invitedEmail,
      role: institutionInvitations.role,
      createdAt: institutionInvitations.createdAt,
    }).from(institutionInvitations).where(eq(institutionInvitations.institutionId, institutionId));
    return [
      ...activeMembers.map((member) => ({ ...member, status: 'active' as const })),
      ...pendingMembers.map((member) => ({ ...member, firstName: null, lastName: null, status: 'pending' as const })),
    ];
  },

  async getInstitutionAnalytics(institutionId: string) {
    const byStatus = await db.select({ status: registrations.status, total: count() })
      .from(registrations).where(eq(registrations.institutionId, institutionId)).groupBy(registrations.status);
    const [total] = await db.select({ total: count() }).from(registrations).where(eq(registrations.institutionId, institutionId));
    return { institutionId, totalRegistrations: total.total, byStatus };
  },

  async getRegistrationFlow(institutionId: string) {
    const [flow] = await db.select().from(registrationFlows).where(eq(registrationFlows.institutionId, institutionId)).limit(1);
    if (!flow) return null;
    const [version] = await db.select().from(registrationFormVersions).where(eq(registrationFormVersions.flowId, flow.id))
      .orderBy(desc(registrationFormVersions.version)).limit(1);
    const fields = version
      ? await db.select().from(registrationFields).where(eq(registrationFields.formVersionId, version.id)).orderBy(asc(registrationFields.sortOrder))
      : [];
    return { flow, version: version ?? null, fields };
  },
};
