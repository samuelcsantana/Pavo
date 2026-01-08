import { Router } from 'express';
import multer, { StorageEngine } from 'multer';
import fs from 'fs';
import { PdfController } from '../controllers/pdf.controller';

const router = Router();
const controller = new PdfController();

const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    // 500 * 1024 * 1024 = 524,288,000 bytes
    fileSize: 500 * 1024 * 1024 
  }
 });

router.post('/split', upload.single('file'), (req, res) => controller.split(req, res));
router.post('/compress', upload.single('file'), (req, res) => controller.compress(req, res));

export default router;