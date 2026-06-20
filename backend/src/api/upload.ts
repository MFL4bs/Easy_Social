import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const uploadDir = process.env.NODE_ENV === 'production'
  ? '/app/uploads'
  : path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpeg|jpg|png|gif|webp|mp4|mov|avi)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${path.extname(file.originalname)}`));
    }
  },
});

// POST /api/upload
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }
    const urls = files.map((f) => `/api/uploads/${f.filename}`);
    res.json({ urls });
  });
});

export default router;
