import 'dotenv/config'; // .env dosyasını otomatik okumak için eklendi
import express from 'express';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { parcels } from './src/db/schema';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Database Connection
  const queryClient = postgres(process.env.DATABASE_URL || '');
  const db = drizzle(queryClient);

  // API Routes
  app.get('/api/parcels', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, 
          name, 
          ST_AsGeoJSON(geometry) as geometry, 
          owner_name, 
          owner_phone, 
          owner_email, 
          status, 
          date 
        FROM parcels
      `);
      
      const formattedResult = result.map((r: any) => ({
        ...r,
        geometry: JSON.parse(r.geometry)
      }));
      
      res.json(formattedResult);
    } catch (err: any) {
      console.error('Error fetching parcels:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/parcels', async (req, res) => {
    try {
      const { name, geometry, ownerName, ownerPhone, ownerEmail, status } = req.body;
      const id = randomUUID();
      
      const geojsonStr = JSON.stringify(geometry);
      
      await db.execute(sql`
        INSERT INTO parcels (id, name, geometry, owner_name, owner_phone, owner_email, status)
        VALUES (
          ${id}, 
          ${name}, 
          ST_GeomFromGeoJSON(${geojsonStr}), 
          ${ownerName || null}, 
          ${ownerPhone || null}, 
          ${ownerEmail || null}, 
          ${status || 'Beklemede'}
        )
      `);
      
      res.status(201).json({ id });
    } catch (err: any) {
      console.error('Error creating parcel:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/parcels/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { ownerName, ownerPhone, ownerEmail, status } = req.body;
      
      await db.execute(sql`
        UPDATE parcels
        SET owner_name = ${ownerName}, owner_phone = ${ownerPhone}, owner_email = ${ownerEmail}, status = ${status}
        WHERE id = ${id}
      `);
      
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error updating parcel:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development (Düzeltildi)
  if (process.env.NODE_ENV !== "production") {
    // Vite sadece development modundayken içeri aktarılır.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();