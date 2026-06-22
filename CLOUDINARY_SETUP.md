# Cloudinary Integration Setup

> **Recommended for Production:** Cloudinary provides CDN delivery, image optimization, and automatic transformations.

## Why Cloudinary?

| Feature | Disk Storage | MongoDB | Cloudinary |
|---------|--------------|---------|-----------|
| Upload Speed | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Scalability | ❌ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| CDN/Caching | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| Image Optimization | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| Backup/Redundancy | Manual | DB Level | Built-in |
| Cost (10GB/month) | Server $ | DB $ | ~$3/mo |
| Best For | Dev/Testing | Small Scale | Production |

## Setup Steps

### 1. Create Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Get your credentials from the **Dashboard**:
   - Cloud Name
   - API Key
   - API Secret

### 2. Configure Environment Variables

**API Server** (`api-server/.env`):
```env
# Choose one:
STORAGE_TYPE=disk              # Current setup (local files)
STORAGE_TYPE=cloudinary        # Production (CDN + optimization)

# Cloudinary Config (if using STORAGE_TYPE=cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# File Upload Limits
MAX_FILE_SIZE=20971520         # 20MB in bytes
```

### 3. Install Cloudinary Package

```bash
cd api-server
pnpm add cloudinary next-cloudinary
pnpm add -D @types/node
```

### 4. Create Storage Adapter

Create [api-server/src/lib/storage-adapter.ts](api-server/src/lib/storage-adapter.ts):

```typescript
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
    return Promise.resolve({
      url: `/api/uploads/${fileName}`,
      fileName: fileName
    });
  }
  
  getFileUrl(fileName: string): string {
    return `/api/uploads/${fileName}`;
  }
  
  async deleteFile(fileName: string): Promise<void> {
    const filePath = path.join(process.env.UPLOAD_DIR || "./uploads", fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
      const result = await cloudinary.uploader.upload(filePath, {
        public_id: fileName.replace(/\.[^.]+$/, ""), // Remove extension
        folder: "invoices",
        resource_type: "auto",
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
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${fileName}`;
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(fileName);
      logger.info({ fileName }, "File deleted from Cloudinary");
    } catch (err) {
      logger.error({ err, fileName }, "Cloudinary deletion failed");
    }
  }
}

export function getStorageProvider(): StorageProvider {
  const storageType = process.env.STORAGE_TYPE || "disk";
  
  if (storageType === "cloudinary") {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      throw new Error("Cloudinary credentials not configured");
    }
    return new CloudinaryStorage();
  }
  
  return new DiskStorage();
}
```

### 5. Update Invoice Routes

Update [api-server/src/routes/invoices.ts](api-server/src/routes/invoices.ts) to use the storage adapter:

```typescript
import { getStorageProvider } from "../lib/storage-adapter";

const storage = getStorageProvider();

// In upload handler, after file is saved locally:
router.post("/invoices/upload", authenticate, upload.array("files", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const results = [];
  for (const file of files) {
    try {
      // Upload to configured storage
      const uploadResult = await storage.uploadFile(file.path, file.filename);
      
      // Create invoice with file URL
      const invoice = await createInvoice({
        fileName: file.originalname,
        fileUrl: uploadResult.url,
        fileType: file.mimetype,
        uploadedBy: req.user?.id,
        status: "pending",
      });

      // Clean up temp file if using Cloudinary
      if (process.env.STORAGE_TYPE === "cloudinary" && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      results.push(formatInvoice(invoice));
    } catch (err) {
      logger.error({ err, fileName: file.originalname }, "Upload failed");
    }
  }

  res.status(201).json({ data: results });
});
```

## Cloudinary Image Transformations

Once integrated, you can add image optimization:

```typescript
// In frontend or backend
const optimizedUrl = fileUrl + "?q=auto&w=800"; // Auto quality, 800px width
const thumbnail = fileUrl + "?q=auto&w=200&h=200&c=fill"; // Thumbnail
const pdfPreview = fileUrl.replace("pdf", "jpg") + "?delay=5"; // PDF first page
```

## Monitoring & Costs

- **Free tier**: 25GB/month storage, unlimited bandwidth
- **Dashboard**: https://cloudinary.com/console/dashboard
- **Billing**: Pay-as-you-go after free tier
- **Usage Reports**: Available in console

## Fallback Strategy

You can support both:

```typescript
const fileUrl = process.env.STORAGE_TYPE === "cloudinary" 
  ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${fileName}`
  : `/api/uploads/${fileName}`;
```

## Migration from Disk to Cloudinary

To migrate existing files:

```bash
# Script to bulk upload existing files
pnpm add dotenv

# Create migrate.mjs in api-server/scripts/
node scripts/migrate-to-cloudinary.mjs
```

---

**Quick Start**: For now, your disk storage works fine. **Switch to Cloudinary** when:
- You deploy to production
- You need image transformations
- You want CDN-delivered images
- You exceed free tier storage limits
