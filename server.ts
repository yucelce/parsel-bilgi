import 'dotenv/config';
import express from 'express';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
// İPTAL EDİLDİ: import { parcels } from './src/db/schema'; -> Bu dosya yükledikleriniz arasında yok, build hatası verir.
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Vercel Postgres (Neon) bağlantısı
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';

if (!connectionString) {
  console.error("KRİTİK HATA: POSTGRES_URL bulunamadı. Lütfen .env dosyanızı kontrol edin.");
}

// DİKKAT: Vercel/Neon veritabanları SSL bağlantısını zorunlu kılar.
const queryClient = postgres(connectionString, { ssl: 'require' });
const db = drizzle(queryClient);

// AKILLI KURULUM: Tabloları ve PostGIS uzantısını otomatik oluşturur
async function initDatabase() {
  try {
    // 1. Coğrafi bilgi sistemi uzantısını aktif et
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis;`);
    
    // 2. Parsels tablosu yoksa otomatik oluştur
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parcels (
        id UUID PRIMARY KEY,
        name TEXT,
        geometry GEOMETRY,
        owner_name TEXT,
        owner_phone TEXT,
        owner_email TEXT,
        status TEXT DEFAULT 'Aktif',
        date TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("PostgreSQL ve Tablo yapısı başarıyla hazırlandı.");
  } catch (err: any) {
    console.error("Veritabanı otomatik kurulum hatası:", err.message);
  }
}
initDatabase();

// API Rotaları
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
    
    // SRID 4326 format desteği sağlandı
    await db.execute(sql`
      INSERT INTO parcels (id, name, geometry, owner_name, owner_phone, owner_email, status)
      VALUES (
        ${id}, 
        ${name}, 
        ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326), 
        ${ownerName || null}, 
        ${ownerPhone || null}, 
        ${ownerEmail || null}, 
        ${status || 'Aktif'}
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

// Statik Dosya Sunumu (Production/Development ayarı)
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