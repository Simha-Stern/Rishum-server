import { Router } from 'express';
import { currentUser, login, logout, register, updateProfile } from './features/auth/auth.controller.js';
import { requireAuthentication, requireInstitutionRole, requireSystemAdmin } from './features/auth/auth.middleware.js';
import { getAllInstitutions } from './features/institutions/institutions.controller.js';
import {
  assignInstitutionMember,
  createInstitution,
  getInstitutionAnalytics,
  getRegistrationFlow,
  listAdminInstitutions,
} from './features/institutions/institution-management.controller.js';
import { getPublicRegistrationForm, publishRegistrationFlow, saveRegistrationFlowDraft } from './features/registrations/registration-flow.controller.js';
import { submitRegistration } from './features/registrations/registrations.controller.js';

export const router = Router();

router.get('/institutions', getAllInstitutions);

router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/logout', requireAuthentication, logout);
router.get('/me', requireAuthentication, currentUser);
router.patch('/me/profile', requireAuthentication, updateProfile);

router.get('/admin/institutions', requireAuthentication, requireSystemAdmin, listAdminInstitutions);
router.post('/admin/institutions', requireAuthentication, requireSystemAdmin, createInstitution);
router.put('/admin/institutions/:institutionId/members', requireAuthentication, requireSystemAdmin, assignInstitutionMember);

router.get('/institutions/:institutionId/analytics', requireAuthentication, requireInstitutionRole('manager'), getInstitutionAnalytics);
router.get('/institutions/:institutionId/registration-flow', requireAuthentication, requireInstitutionRole('secretary'), getRegistrationFlow);
router.put('/institutions/:institutionId/registration-flow', requireAuthentication, requireInstitutionRole('secretary'), saveRegistrationFlowDraft);
router.post('/institutions/:institutionId/registration-flow/publish', requireAuthentication, requireInstitutionRole('secretary'), publishRegistrationFlow);

router.get('/public/institutions/:institutionId/registration-form', getPublicRegistrationForm);
router.post('/public/institutions/:institutionId/registrations', requireAuthentication, submitRegistration);
