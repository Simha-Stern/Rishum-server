import { Router } from "express";
import {
  currentUser,
  login,
  logout,
  register,
  updateProfile,
} from "./features/auth/auth.controller.js";
import {
  loadOptionalAuthentication,
  requireAuthentication,
  requireInstitutionRole,
  requireSystemAdmin,
} from "./features/auth/auth.middleware.js";
import {
  assignInstitutionMember,
  createInstitution,
  deleteInstitution,
  getInstitutionAnalytics,
  inviteInstitutionSecretary,
  listInstitutionTeam,
  listAdminInstitutions,
  removeInstitutionTeamMember,
  updateInstitutionTeamMember,
  updateInstitution,
  getAllInstitutions,
} from "./features/institutions/institutions.controller.js";
import {
  closeRegistrationFlow,
  createRegistrationFieldCatalogEntry,
  createRegistrationFlowDraft,
  getPublicRegistrationForm,
  getRegistrationFlow,
  listAvailableRegistrationFields,
  listOpenRegistrationFlows,
  listRegistrationFieldCatalog,
  publishRegistrationFlow,
  saveRegistrationFlowDraft,
  submitRegistration,
} from "./features/registrations/registrations.controller.js";

export const router = Router();

const systemAdminOnly = [requireAuthentication, requireSystemAdmin];
const institutionManagerOnly = [
  requireAuthentication,
  requireInstitutionRole("manager"),
];
const institutionSecretaryOnly = [
  requireAuthentication,
  requireInstitutionRole("secretary"),
];

router.get("/institutions", getAllInstitutions);

router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/logout", requireAuthentication, logout);
router.get("/me", requireAuthentication, currentUser);
router.patch("/me/profile", requireAuthentication, updateProfile);

router.get("/admin/institutions", ...systemAdminOnly, listAdminInstitutions);
router.post("/admin/institutions", ...systemAdminOnly, createInstitution);
router.put(
  "/admin/institutions/:institutionId",
  ...systemAdminOnly,
  updateInstitution,
);
router.delete(
  "/admin/institutions/:institutionId",
  ...systemAdminOnly,
  deleteInstitution,
);
router.put(
  "/admin/institutions/:institutionId/members",
  ...systemAdminOnly,
  assignInstitutionMember,
);
router.get(
  "/admin/registration-field-catalog",
  ...systemAdminOnly,
  listRegistrationFieldCatalog,
);
router.post(
  "/admin/registration-field-catalog",
  ...systemAdminOnly,
  createRegistrationFieldCatalogEntry,
);

router.get(
  "/institutions/:institutionId/analytics",
  ...institutionManagerOnly,
  getInstitutionAnalytics,
);
router.get(
  "/institutions/:institutionId/members",
  ...institutionManagerOnly,
  listInstitutionTeam,
);
router.post(
  "/institutions/:institutionId/members",
  ...institutionManagerOnly,
  inviteInstitutionSecretary,
);
router.put(
  "/institutions/:institutionId/members/:email",
  ...institutionManagerOnly,
  updateInstitutionTeamMember,
);
router.delete(
  "/institutions/:institutionId/members/:email",
  ...institutionManagerOnly,
  removeInstitutionTeamMember,
);
router.get(
  "/institutions/:institutionId/registration-fields",
  ...institutionSecretaryOnly,
  listAvailableRegistrationFields,
);
router.get(
  "/institutions/:institutionId/registration-flows/open",
  ...institutionSecretaryOnly,
  listOpenRegistrationFlows,
);
router.post(
  "/institutions/:institutionId/registration-flows",
  ...institutionSecretaryOnly,
  createRegistrationFlowDraft,
);
router.get(
  "/institutions/:institutionId/registration-flows/:flowId",
  ...institutionSecretaryOnly,
  getRegistrationFlow,
);
router.put(
  "/institutions/:institutionId/registration-flows/:flowId",
  ...institutionSecretaryOnly,
  saveRegistrationFlowDraft,
);
router.post(
  "/institutions/:institutionId/registration-flows/:flowId/publish",
  ...institutionSecretaryOnly,
  publishRegistrationFlow,
);
router.post(
  "/institutions/:institutionId/registration-flows/:flowId/close",
  ...institutionSecretaryOnly,
  closeRegistrationFlow,
);

router.get(
  "/public/institutions/:institutionId/registration-form",
  getPublicRegistrationForm,
);
router.post(
  "/public/institutions/:institutionId/registrations",
  loadOptionalAuthentication,
  submitRegistration,
);
