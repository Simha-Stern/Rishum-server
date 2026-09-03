import type { RequestHandler } from "express";
import { HttpError } from "../../lib/http-error.js";
import { authService } from "./auth.service.js";
import type { InstitutionRole } from "./auth.types.js";

const bearerToken = (authorization?: string): string | null => {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
};

export const requireAuthentication: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const token = bearerToken(request.header("authorization"));
    if (!token) throw new HttpError(401, "Authentication is required.");
    const auth = await authService.getContext(token);
    if (!auth)
      throw new HttpError(
        401,
        "Your session has expired. Please sign in again.",
      );
    request.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
};

export const loadOptionalAuthentication: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const token = bearerToken(request.header("authorization"));
    if (token)
      request.auth = (await authService.getContext(token)) ?? undefined;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireSystemAdmin: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (!request.auth?.user.isSystemAdmin)
    return next(
      new HttpError(403, "System administrator permission is required."),
    );
  next();
};

export const requireInstitutionRole =
  (...roles: InstitutionRole[]): RequestHandler =>
  (request, _response, next) => {
    const institutionId = request.params["institutionId"];
    const auth = request.auth;
    if (!auth || !institutionId)
      return next(new HttpError(401, "Authentication is required."));
    if (
      auth.memberships.some(
        (membership) =>
          membership.institutionId === institutionId &&
          roles.includes(membership.role),
      )
    ) {
      return next();
    }
    return next(
      new HttpError(403, "You do not have permission for this institution."),
    );
  };

export const getBearerToken = (authorization?: string) =>
  bearerToken(authorization);
