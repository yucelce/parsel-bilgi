// server.ts
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';

if (!connectionString) {
  console.error("KRİTİK HATA: POSTGRES_URL bulunamadı. Lütfen .env dosyanızı kontrol edin.");
}

const queryClient = postgres(connectionString, { ssl: 'require' });
const db = drizzle(queryClient);

async function initDatabase() {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis;`);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parcels (
        id UUID PRIMARY KEY,
        name TEXT,
        geometry GEOMETRY,
        owner_name TEXT,
        owner_phone TEXT,
        owner_email TEXT,
        status TEXT DEFAULT 'Aktif',
        date TIMESTAMP DEFAULT NOW(),
        ada_parsel TEXT,
        has_work_license BOOLEAN DEFAULT false
      );
    `);
    
    // Mevcut tabloya yeni sütunları güvenli şekilde ekler (Eğer önceden varsa hata vermez)
    await db.execute(sql`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS ada_parsel TEXT;`);
    await db.execute(sql`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS has_work_license BOOLEAN DEFAULT false;`);
    
    console.log("PostgreSQL ve Tablo yapısı başarıyla hazırlandı.");
  } catch (err: any) {
    console.error("Veritabanı otomatik kurulum hatası:", err.message);
  }
}
initDatabase();

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
        date,
        ada_parsel,
        has_work_license
      FROM parcels
    `);
    
    const formattedResult = result.map((r: any) => ({
      ...r,
      geometry: JSON.parse(r.geometry)
    }));
    
    res.json(formattedResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/parcels', async (req, res) => {
  try {
    const { name, geometry, ownerName, ownerPhone, ownerEmail, status, adaParsel, hasWorkLicense } = req.body;
    const id = randomUUID();
    const geojsonStr = JSON.stringify(geometry);
    
    await db.execute(sql`
      INSERT INTO parcels (id, name, geometry, owner_name, owner_phone, owner_email, status, ada_parsel, has_work_license)
      VALUES (
        ${id}, 
        ${name}, 
        ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}::json), 4326), 
        ${ownerName || null}, 
        ${ownerPhone || null}, 
        ${ownerEmail || null}, 
        ${status || 'Aktif'},
        ${adaParsel || null},
        ${hasWorkLicense || false}
      )
    `);
    
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/parcels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerName, ownerPhone, ownerEmail, status, name, adaParsel, hasWorkLicense } = req.body;
    
    await db.execute(sql`
      UPDATE parcels
      SET 
        owner_name = ${ownerName}, 
        owner_phone = ${ownerPhone}, 
        owner_email = ${ownerEmail}, 
        status = ${status},
        name = ${name},
        ada_parsel = ${adaParsel},
        has_work_license = ${hasWorkLicense}
      WHERE id = ${id}
    `);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== "production") {
  import('vite').then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;