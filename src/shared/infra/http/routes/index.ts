import express from 'express';
import { pdfRoutes } from '../../../../modules/pdf/pdf.routes';

const routes = express.Router();

routes.use('/pdf', pdfRoutes);

export { routes };
