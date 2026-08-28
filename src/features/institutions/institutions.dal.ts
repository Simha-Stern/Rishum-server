import { asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { institutions } from '../../db/schema.js';

export const institutionsDal = {
  findAll: () => db.select().from(institutions).orderBy(asc(institutions.name)),
};
