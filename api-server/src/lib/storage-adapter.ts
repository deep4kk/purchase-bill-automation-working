import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

export interface StorageProvider {
  uploadFile(filePath: string, fileName: string): Promise<{ url: string; fileName: string }>;
  getFileUrl(fileName: string): string;
  deleteFile(fileName: string): Promise<void>;
}

class DiskStorage implements StorageProvider {
  uploadFile(filePath: string, fileName: string): Promise<{ url: string; fileName: string }> {
    logger.info({ fileName, path: filePath }, "File stored on disk");
    return Promise.resolve({
      url: `/api/uploads/${fileName}`,
      fileName: fileName,
    });
  }

  getFileUrl(fileName: string): string {
    return `/api/uploads/${fileName}`;
  }

  async deleteFile(fileName: string): Promise<void> {
    const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info({ fileName }, "File deleted from disk");
    }
  }
}

class CloudinaryStorage implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(filePath: string, fileName: string): Promise<{ url: string; fileName: string }> {
    try {
      const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, "");
      const result = await cloudinary.uploader.upload(filePath, {
        public_id: `invoices/${fileNameWithoutExt}`,
        resource_type: "auto",
        folder: "invoices",
      });
      logger.info({ publicId: result.public_id, url: result.secure_url }, "File uploaded to Cloudinary");
      return {
        url: result.secure_url,
        fileName: result.public_id,
      };
    } catch (err) {
      logger.error({ err, fileName }, "Cloudinary upload failed");
      throw err;
    }
  }

  getFileUrl(fileName: string): string {
    if (fileName.startsWith("http")) return fileName; // Already a full URL
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${fileName}`;
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const publicId = fileName.replace("invoices/", "");
      await cloudinary.uploader.destroy(publicId);
      logger.info({ fileName }, "File deleted from Cloudinary");
    } catch (err) {
      logger.error({ err, fileName }, "Cloudinary deletion failed");
    }
  }
}

export function getStorageProvider(): StorageProvider {
  const storageType = process.env.STORAGE_TYPE || "disk";

  if (storageType === "cloudinary") {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      logger.warn("Cloudinary credentials not fully configured, falling back to disk storage");
      return new DiskStorage();
    }
    logger.info("Using Cloudinary storage");
    return new CloudinaryStorage();
  }

  logger.info("Using disk storage");
  return new DiskStorage();
}
