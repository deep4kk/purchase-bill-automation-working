import path from "path";
import fs from "fs";
import { logger } from "./logger";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info({ dir: UPLOAD_DIR }, "Created upload directory");
  }
}

export function getFileUrl(filename: string): string {
  return `/api/uploads/${filename}`;
}

export function getFilePath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}

export { UPLOAD_DIR };
