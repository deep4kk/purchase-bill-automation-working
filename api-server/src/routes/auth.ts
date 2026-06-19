import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { signToken, authenticate, requireRole } from "../lib/auth";
import {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  ListUsersQueryParams,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
} from "@workspace/api-zod";
import {
  findUsers,
  findUserById,
  findUserByEmail,
  findUserByResetToken,
  createUser,
  updateUser,
  toStringId,
} from "../lib/dal";

const router = Router();

function formatUser(u: { _id: { toHexString: () => string }; name: string; email: string; role: string; createdAt: Date }) {
  return {
    id: u._id.toHexString(),
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password, role } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({ name, email, passwordHash, role: role ?? "accounts" });
  const token = signToken({ userId: user._id.toHexString(), email: user.email, role: user.role, name: user.name });
  res.status(201).json({ token, user: formatUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = signToken({ userId: user._id.toHexString(), email: user.email, role: user.role, name: user.name });
  res.json({ token, user: formatUser(user) });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await findUserByEmail(parsed.data.email);
  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000);
    await updateUser(user._id, { resetToken, resetTokenExpiry: expiry });
    req.log.info({ email: parsed.data.email, resetToken }, "Password reset token generated");
  }
  res.json({ message: "If that email exists, a reset link has been sent" });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { token, password } = parsed.data;
  const user = await findUserByResetToken(token);
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await updateUser(user._id, { passwordHash, resetToken: undefined, resetTokenExpiry: undefined });
  res.json({ message: "Password reset successfully" });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const user = await findUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

router.get("/auth/users", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const result = await findUsers({ page, limit });
  res.json({ data: result.data.map(formatUser), total: result.total, page, limit });
});

router.patch("/auth/users/:userId/role", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const userId = req.params.userId;
  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await updateUser(userId, { role: parsed.data.role });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

export default router;
