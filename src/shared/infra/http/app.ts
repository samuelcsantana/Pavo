import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { routes } from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from '../logger';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Swagger Setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PDF Backend API',
      version: '1.0.0',
      description: 'A scalable PDF manipulation API',
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Request Logging Middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url}`);
  next();
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ status: 'PDF API Online 🚀', system: process.platform });
});

app.use(errorHandler);

export { app };
