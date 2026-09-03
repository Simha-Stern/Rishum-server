import type { RequestHandler } from "express";
import { institutionsService } from "./institutions.service.js";

export const getAllInstitutions: RequestHandler = async (
  _request,
  response,
  next,
) => {
  try {
    response.status(200).json(await institutionsService.list());
  } catch (error) {
    next(error);
  }
};

export const listAdminInstitutions: RequestHandler = async (
  _request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(await institutionsService.listAdminInstitutions());
  } catch (error) {
    next(error);
  }
};

export const createInstitution: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(201)
      .json(
        await institutionsService.createInstitution(
          request.body,
          request.auth!.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const updateInstitution: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(
        await institutionsService.updateInstitution(
          request.params["institutionId"],
          request.body,
          request.auth!.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const deleteInstitution: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    await institutionsService.deleteInstitution(
      request.params["institutionId"],
    );
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const assignInstitutionMember: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(
        await institutionsService.assignInstitutionMember(
          request.params["institutionId"],
          request.body,
          request.auth!.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const listInstitutionTeam: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(
        await institutionsService.listInstitutionTeam(
          request.params["institutionId"],
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const inviteInstitutionSecretary: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(201)
      .json(
        await institutionsService.inviteInstitutionSecretary(
          request.params["institutionId"],
          request.body,
          request.auth!.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const updateInstitutionTeamMember: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    await institutionsService.updateInstitutionTeamMember(
      request.params["institutionId"],
      request.params["email"],
      request.body,
      request.auth!.user.id,
    );
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const removeInstitutionTeamMember: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    await institutionsService.removeInstitutionTeamMember(
      request.params["institutionId"],
      request.params["email"],
      request.auth!.user.id,
    );
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getInstitutionAnalytics: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(
        await institutionsService.getInstitutionAnalytics(
          request.params["institutionId"],
        ),
      );
  } catch (error) {
    next(error);
  }
};
