export type InstitutionRole = "manager" | "secretary";

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  idNumber: string | null;
  isSystemAdmin: boolean;
}

export interface AuthContext {
  user: CurrentUser;
  memberships: Array<{ institutionId: string; role: InstitutionRole }>;
  tokenHash: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
