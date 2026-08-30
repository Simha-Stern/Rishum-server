import type { RequestHandler } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { getBearerToken } from './auth.middleware.js';
import { authService } from './auth.service.js';

const recordBody = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'A JSON object is required.');
  return value as Record<string, unknown>;
};

const requiredString = (body: Record<string, unknown>, key: string): string => {
  const value = body[key];
  if (typeof value !== 'string') throw new HttpError(400, `${key} must be a string.`);
  return value;
};

const optionalString = (body: Record<string, unknown>, key: string): string | undefined => {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${key} must be a string.`);
  return value;
};

export const register: RequestHandler = async (request, response, next) => {
  try {
    const body = recordBody(request.body);
    const result = await authService.register({
      email: requiredString(body, 'email'),
      password: requiredString(body, 'password'),
      firstName: requiredString(body, 'firstName'),
      lastName: requiredString(body, 'lastName'),
      phone: optionalString(body, 'phone'),
      idNumber: optionalString(body, 'idNumber'),
    });
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (request, response, next) => {
  try {
    const body = recordBody(request.body);
    response.status(200).json(await authService.login(requiredString(body, 'email'), requiredString(body, 'password')));
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (request, response, next) => {
  try {
    const token = getBearerToken(request.header('authorization'));
    if (!token) throw new HttpError(401, 'Authentication is required.');
    await authService.logout(token);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const currentUser: RequestHandler = (request, response) => {
  const { user, memberships } = request.auth!;
  response.status(200).json({ user, memberships });
};

export const updateProfile: RequestHandler = async (request, response, next) => {
  try {
    const body = recordBody(request.body);
    const user = await authService.updateProfile(request.auth!.user.id, {
      firstName: optionalString(body, 'firstName'),
      lastName: optionalString(body, 'lastName'),
      phone: optionalString(body, 'phone'),
      idNumber: optionalString(body, 'idNumber'),
    });
    response.status(200).json(user);
  } catch (error) {
    next(error);
  }
};
