import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { UserRole } from './domainEngine';
import { getStore, hashToken, persistStore, uid } from './store';

const JWT_SECRET = process.env.JWT_SECRET || 'smartlib-dev-ephemeral-signing-key-change-in-prod';
const ACCESS_TTL = process.env.JWT_ACCESS_EXPIRATION || '2h';
const REFRESH_TTL_DAYS = 7;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string | null;
  institutionalId: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
      institutionalId: user.institutionalId,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL as jwt.SignOptions['expiresIn'] }
  );
}

export function issueRefreshToken(userId: string, existingFamilyId?: string): string {
  const store = getStore();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000).toISOString();

  store.refreshTokens.push({
    id: uid('rt'),
    userId,
    tokenFamilyId: existingFamilyId || uid('fam'),
    tokenHash,
    expiresAt,
    revoked: false,
    replacedByTokenHash: null,
  });
  persistStore();
  return rawToken;
}

export function rotateRefreshToken(rawToken: string): { userId: string; newRefreshToken: string } | null {
  const store = getStore();
  const tokenHash = hashToken(rawToken);
  const record = store.refreshTokens.find((t) => t.tokenHash === tokenHash);
  if (!record) return null;

  if (record.revoked || new Date(record.expiresAt).getTime() < Date.now()) {
    // Replay detected: revoke entire family
    store.refreshTokens.forEach((t) => {
      if (t.tokenFamilyId === record.tokenFamilyId) {
        t.revoked = true;
      }
    });
    persistStore();
    return null;
  }

  const nextRaw = crypto.randomBytes(32).toString('hex');
  const nextHash = hashToken(nextRaw);
  record.revoked = true;
  record.replacedByTokenHash = nextHash;

  store.refreshTokens.push({
    id: uid('rt'),
    userId: record.userId,
    tokenFamilyId: record.tokenFamilyId,
    tokenHash: nextHash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86400000).toISOString(),
    revoked: false,
    replacedByTokenHash: null,
  });
  persistStore();

  return { userId: record.userId, newRefreshToken: nextRaw };
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const store = getStore();
    const user = store.users.find((u) => u.id === decoded.sub);
    if (!user || user.accountStatus === 'SUSPENDED') {
      res.status(401).json({ success: false, message: 'Account is inactive or suspended.' });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
      institutionalId: user.institutionalId,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired access token.' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this operation.',
      });
      return;
    }
    next();
  };
}

// Simple sliding-window rate limiter for sensitive auth endpoints
const rateBuckets = new Map<string, number[]>();

export function rateLimit(maxRequests = 40, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const history = (rateBuckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
    if (history.length >= maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please wait briefly before retrying.',
      });
      return;
    }
    history.push(now);
    rateBuckets.set(key, history);
    next();
  };
}
