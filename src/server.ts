import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.routes';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'PDF API Online 🚀', system: process.platform });
});

app.listen(PORT, () => {
  console.log(`\n🔥 Server running on WSL at http://localhost:${PORT}`);
});