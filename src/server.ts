import 'express-async-errors';
import { app } from './shared/infra/http/app';
import { env } from './config/env';
import { logger } from './shared/infra/logger';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`🔥 Server running on http://localhost:${PORT}`);
  logger.info(`📚 Documentation available at http://localhost:${PORT}/api-docs`);
});

server.setTimeout(300000);
