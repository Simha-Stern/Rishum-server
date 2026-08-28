import { institutionsDal } from './institutions.dal.js';

export const institutionsService = {
  list: () => institutionsDal.findAll(),
};
