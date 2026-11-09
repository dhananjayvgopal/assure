/**
 * Local Standalone POS Server for Garment Shops
 * Serves the compiled static frontend on the local store network (LAN)
 * allowing desktop computers, tablets, and mobile registers to connect on port 3000.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { databaseApi, databasePath } from './server/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
// Listen on the shop LAN so phones/tablets on the same network can connect.
const HOST = '0.0.0.0';

app.use(express.json({ limit: '12mb' }));
app.use('/api', databaseApi);

// Serve static build files from dist directory if available
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Health check endpoint for local monitoring
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    app: 'Assure POS',
    database: 'sqlite',
    timestamp: new Date().toISOString(),
  });
});

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('Assure POS server is running. Run "npm run build" to generate client assets.');
    }
  });
});

app.listen(Number(PORT), HOST, () => {
  console.log(`[POS Server] Assure POS listening on http://${HOST}:${PORT}`);
  console.log(`[POS Server] SQLite database: ${databasePath()}`);
});
