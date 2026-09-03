import type { RequestHandler } from "express";
import { registrationsService } from "./registrations.service.js";

export const listRegistrationFieldCatalog: RequestHandler = async (
  _request,
  response,
  next,
) => {
  try {
    response.status(200).json(await registrationsService.listCatalog());
  } catch (error) {
    next(error);
  }
};
export const createRegistrationFieldCatalogEntry: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(201)
      .json(
        await registrationsService.createCatalog(
          request.body,
          request.auth!.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};
export const listOpenRegistrationFlows: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(
        await registrationsService.listOpenFlows(
          request.params["institutionId"],
        ),
      );
  } catch (error) {
    next(error);
  }
};
export const getRegistrationFlow: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(
        await registrationsService.getFlow(
          request.params["institutionId"],
          request.params["flowId"],
        ),
      );
  } catch (error) {
    next(error);
  }
};
export const listAvailableRegistrationFields: RequestHandler = async (
  _request,
  response,
  next,
) => {
  try {
    response.status(200).json(await registrationsService.listCatalog());
  } catch (error) {
    next(error);
  }
};
export const createRegistrationFlowDraft: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(201)
      .json(
        await registrationsService.saveDraft(
          request.params["institutionId"],
          null,
          request.body,
          request.auth!.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};
export const saveRegistrationFlowDraft: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(201)
      .json(
        await registrationsService.saveDraft(
          request.params["institutionId"],
          request.params["flowId"],
          request.body,
          request.auth!.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};
export const publishRegistrationFlow: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    await registrationsService.publish(
      request.params["institutionId"],
      request.params["flowId"],
      request.body,
      request.auth!.user.id,
    );
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};
export const closeRegistrationFlow: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    await registrationsService.close(
      request.params["institutionId"],
      request.params["flowId"],
      request.auth!.user.id,
    );
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};
export const getPublicRegistrationForm: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(200)
      .json(
        await registrationsService.getPublicForm(
          request.params["institutionId"],
        ),
      );
  } catch (error) {
    next(error);
  }
};
export const submitRegistration: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    response
      .status(201)
      .json(
        await registrationsService.submit(
          request.params["institutionId"],
          request.body,
          request.auth?.user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
};
