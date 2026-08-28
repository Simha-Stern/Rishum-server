import { Router } from 'express';
import { listInstitutions } from './features/institutions/institutions.controller.js';

export const router = Router();

router.get('/institutions', listInstitutions);
