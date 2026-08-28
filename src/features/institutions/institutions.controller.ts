import type { RequestHandler } from 'express';
import { institutionsService } from './institutions.service.js';

export const listInstitutions: RequestHandler = async (_request, response, next) => {
  try {
    const institutions = await institutionsService.list();
    response.status(200).json(institutions);
  } catch (error) {
    next(error);
  }
};
