import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRoutes from './routes/api.routes';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'PDF API Online 🚀', system: process.platform });
});

const server = app.listen(PORT, () => {
  console.log(`\n🔥 Server running on WSL at http://localhost:${PORT}`);
});

server.setTimeout(300000);