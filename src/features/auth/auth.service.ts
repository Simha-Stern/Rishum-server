import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { institutionInvitations, institutionMemberships, sessions, users } from '../../db/Schemes/index.js';
import { HttpError } from '../../lib/http-error.js';
import type { AuthContext, CurrentUser } from './auth.types.js';
import { hashPassword, verifyPassword } from './passwords.js';

const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const isBootstrapAdmin = (email: string) => normalizeEmail(process.env['BOOTSTRAP_ADMIN_EMAIL'] ?? '') === email;

const toCurrentUser = (user: typeof users.$inferSelect): CurrentUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  idNumber: user.idNumber,
  isSystemAdmin: user.isSystemAdmin,
});

const createSession = async (userId: string) => {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    userId,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + sessionLifetimeMs),
  });
  return token;
};

export const authService = {
  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    idNumber?: string;
  }) {
    const email = normalizeEmail(input.email);
    if (!email || !input.firstName.trim() || !input.lastName.trim()) {
      throw new HttpError(400, 'Email, first name and last name are required.');
    }
    if (input.password.length < 10) {
      throw new HttpError(400, 'Password must contain at least 10 characters.');
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const user = await db.transaction(async (transaction) => {
      const [createdUser] = await transaction.insert(users).values({
        email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        idNumber: input.idNumber?.trim() || null,
        isSystemAdmin: isBootstrapAdmin(email),
      }).returning();
      const invitations = await transaction.select({
        institutionId: institutionInvitations.institutionId,
        role: institutionInvitations.role,
      }).from(institutionInvitations).where(eq(institutionInvitations.invitedEmail, email));

      if (invitations.length) {
        await transaction.insert(institutionMemberships).values(invitations.map((invitation) => ({
          userId: createdUser.id,
          institutionId: invitation.institutionId,
          role: invitation.role,
        }))).onConflictDoNothing();
        await transaction.delete(institutionInvitations).where(eq(institutionInvitations.invitedEmail, email));
      }
      return createdUser;
    });

    return { user: toCurrentUser(user), token: await createSession(user.id) };
  },

  async login(email: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password.');
    }
    return { user: toCurrentUser(user), token: await createSession(user.id) };
  },

  async getContext(token: string): Promise<AuthContext | null> {
    const hashedToken = tokenHash(token);
    const [session] = await db.select().from(sessions).where(
      and(eq(sessions.tokenHash, hashedToken), gt(sessions.expiresAt, new Date())),
    ).limit(1);
    if (!session) return null;

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) return null;

    const memberships = await db.select({
      institutionId: institutionMemberships.institutionId,
      role: institutionMemberships.role,
    }).from(institutionMemberships).where(eq(institutionMemberships.userId, user.id));

    return { user: toCurrentUser(user), memberships, tokenHash: hashedToken };
  },

  async logout(token: string) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  },

  async updateProfile(userId: string, input: { firstName?: string; lastName?: string; phone?: string; idNumber?: string }) {
    const values = {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
      ...(input.idNumber !== undefined ? { idNumber: input.idNumber.trim() || null } : {}),
      updatedAt: new Date(),
    };
    const [user] = await db.update(users).set(values).where(eq(users.id, userId)).returning();
    return toCurrentUser(user);
  },
};
