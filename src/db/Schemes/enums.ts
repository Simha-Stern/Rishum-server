import { pgEnum } from 'drizzle-orm/pg-core';

export const institutionMemberRole = pgEnum('institution_member_role', ['manager', 'secretary']);
export const registrationFlowStatus = pgEnum('registration_flow_status', ['draft', 'published', 'closed']);
export const registrationStatus = pgEnum('registration_status', ['submitted', 'under_review', 'accepted', 'rejected']);
