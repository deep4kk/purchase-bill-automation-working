# Storage Options Comparison & Setup

## Quick Decision Guide

Choose based on your needs:

### 🔧 **Current Setup: Disk Storage**
- **Files stored in**: `api-server/uploads/`
- **Served from**: `/api/uploads/{filename}`
- **Best for**: Development, testing, small deployments
- **Pros**: Zero setup, instant, free
- **Cons**: Limited scalability, manual backup needed, server-dependent

### 💾 **Option 1: MongoDB GridFS**
- **Files stored in**: MongoDB as binary data
- **Best for**: Everything stays in one database
- **Pros**: 
  - Automatic backup with database
  - Works with MongoDB Atlas
  - No separate file server needed
  - ACID transactions with metadata
- **Cons**:
  - Slower for large files (>100MB)
  - 16MB per document limit (needs chunking)
  - Database grows large quickly
  - No image optimization/CDN

### ☁️ **Option 2: Cloudinary (Recommended for Production)**
- **Files stored in**: CDN globally
- **Best for**: Production systems, scaling
- **Pros**:
  - Automatic image optimization
  - Global CDN (faster delivery)
  - Automatic transformations (resize, crop, etc.)
  - Handles unlimited file sizes
  - Built-in backup/redundancy
  - Free tier includes 25GB/month
- **Cons**:
  - External dependency (internet required)
  - Small monthly cost after free tier
  - API rate limits

---

## Implementation Options

### Option A: MongoDB GridFS (In-Database Storage)

#### Install Dependencies
```bash
cd api-server
pnpm add gridfs-stream
```

#### Create MongoDB GridFS Handler

Create [api-server/src/lib/gridfs.ts](api-server/src/lib/gridfs.ts):

```typescript
import { GridFSBucket, ObjectId } from "mongodb";
import fs from "fs";
import { getDb } from "./mongodb";
import { logger } from "./logger";

let bucket: GridFSBucket;

export async function initGridFS(): Promise<GridFSBucket> {
  const db = getDb();
  bucket = new GridFSBucket(db);
  logger.info("GridFS initialized");
  return bucket;
}

export async function uploadFileToGridFS(filePath: string, fileName: string, metadata?: any): Promise<ObjectId> {
  if (!bucket) await initGridFS();

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);
    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: {
        uploadedAt: new Date(),
        ...metadata,
      },
    });

    readStream.pipe(uploadStream);

    uploadStream.on("finish", (file) => {
      logger.info({ fileId: file._id, fileName }, "File uploaded to GridFS");
      resolve(file._id);
    });

    uploadStream.on("error", (err) => {
      logger.error({ err, fileName }, "GridFS upload failed");
      reject(err);
    });
  });
}

export async function downloadFileFromGridFS(fileId: string): Promise<fs.ReadStream> {
  if (!bucket) await initGridFS();
  return bucket.openDownloadStream(new ObjectId(fileId));
}

export async function deleteFileFromGridFS(fileId: string): Promise<void> {
  if (!bucket) await initGridFS();
  await bucket.delete(new ObjectId(fileId));
  logger.info({ fileId }, "File deleted from GridFS");
}

export async function getFileInfoFromGridFS(fileId: string): Promise<any> {
  if (!bucket) await initGridFS();
  const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
  return files[0] || null;
}
```

#### Update Invoice Routes for GridFS

In [api-server/src/routes/invoices.ts](api-server/src/routes/invoices.ts):

```typescript
import { uploadFileToGridFS, deleteFileFromGridFS } from "../lib/gridfs";

router.post("/invoices/upload", authenticate, upload.array("files", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const results = [];
  for (const file of files) {
    try {
      // Store file in GridFS
      const gridfsFileId = await uploadFileToGridFS(file.path, file.filename, {
        originalName: file.originalname,
        mimeType: file.mimetype,
        uploadedBy: req.user?.id,
      });

      // Create invoice with GridFS file ID
      const invoice = await createInvoice({
        fileName: file.originalname,
        fileUrl: `/api/uploads/${gridfsFileId}`, // GridFS endpoint
        gridfsFileId: gridfsFileId.toString(),   // Store ID in DB
        fileType: file.mimetype,
        uploadedBy: req.user?.id,
        status: "pending",
      });

      // Clean up temp file
      fs.unlinkSync(file.path);

      results.push(formatInvoice(invoice));
    } catch (err) {
      logger.error({ err }, "Upload failed");
    }
  }

  res.json({ data: results });
});

// Download from GridFS
router.get("/api/uploads/:fileId", async (req, res) => {
  try {
    const stream = await downloadFileFromGridFS(req.params.fileId);
    stream.pipe(res);
  } catch (err) {
    res.status(404).json({ error: "File not found" });
  }
});
```

#### Update Invoice Schema

In [api-server/src/lib/schemas.ts](api-server/src/lib/schemas.ts), add:

```typescript
export interface Invoice {
  // ... existing fields ...
  gridfsFileId?: string; // Add this field
}
```

---

### Option B: Cloudinary (Recommended for Production)

👉 See [CLOUDINARY_SETUP.md](./CLOUDINARY_SETUP.md) for detailed setup

---

## Comparison Table

| Aspect | Disk | GridFS | Cloudinary |
|--------|------|--------|-----------|
| **Setup Time** | 0 min | 15 min | 10 min |
| **Monthly Cost** | $0 | +DB cost | ~$0 (free tier) |
| **Max File Size** | Unlimited | 16GB* | Unlimited |
| **Performance** | Fast | Medium | Very Fast (CDN) |
| **Backup** | Manual | Auto (DB) | Auto |
| **Scalability** | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Image Optimization** | ❌ | ❌ | ✅ |
| **Best For** | Dev | Small-Med | Production |

*GridFS can handle >16MB with chunking, but becomes slower

---

## Migration Path

**Recommended progression:**

1. **Development**: Use disk storage (current)
2. **Testing/Staging**: Use GridFS (keep with DB)
3. **Production**: Use Cloudinary (scale & optimize)

---

## Your Current Setup

```
✅ Disk Storage active
   └─ Files: api-server/uploads/
   └─ Served: /api/uploads/{filename}
   └─ Status: Working for invoices
```

**Next Steps**:
- For now: Stick with disk storage (it works!)
- When scaling: Switch to Cloudinary
- Want DB integration: Consider GridFS for staging

---

## Configuration in `.env`

```env
# Storage selection
STORAGE_TYPE=disk              # or: gridfs, cloudinary

# For GridFS (already connected via MONGODB_URI)
# No additional config needed

# For Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

Choose what works best for your current needs. You can switch later! 🚀
