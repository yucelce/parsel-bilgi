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
    
    // 1. PARSELLER TABLOSU
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parcels (
        id UUID PRIMARY KEY,
        name TEXT,
        geometry GEOMETRY,
        status TEXT DEFAULT 'Aktif',
        date TIMESTAMP DEFAULT NOW(),
        ada_parsel TEXT,
        zoning_status TEXT DEFAULT 'Sanayi',
        area_m2 NUMERIC DEFAULT 0
      );
    `);
    
    // 2. YAPILAR/BİNALAR TABLOSU
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS structures (
        id UUID PRIMARY KEY,
        parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
        name TEXT,
        building_type TEXT
      );
    `);

    // 3. FİRMA VE KİŞİLER TABLOSU (Malik/Kiracı)
    // 3. MERKEZİ PAYDAŞLAR (KİŞİ/FİRMA) TABLOSU
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS entities (
        id UUID PRIMARY KEY,
        type TEXT DEFAULT 'Şirket',
        name TEXT,
        tc_vkn TEXT,
        tax_office TEXT,
        phone TEXT,
        email TEXT
      );
    `);

    // 4. BİNA - PAYDAŞ İLİŞKİ TABLOSU (Hangi binada, kim, hangi rolde?)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS structure_entities (
        id UUID PRIMARY KEY,
        structure_id UUID REFERENCES structures(id) ON DELETE CASCADE,
        entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
        role TEXT,
        has_work_license BOOLEAN DEFAULT false
      );
    `);
    
    // Eskiden kalan sütunların hata vermemesi için güvenli eklemeler
    await db.execute(sql`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS ada_parsel TEXT;`);
    
    console.log("PostgreSQL İlişkisel Tablo yapısı başarıyla hazırlandı.");
  } catch (err: any) {
    console.error("Veritabanı otomatik kurulum hatası:", err.message);
  }
}
initDatabase();

// TÜM VERİLERİ İÇ İÇE (NESTED) GETİR
// TÜM VERİLERİ İÇ İÇE (NESTED) GETİR
app.get('/api/parcels', async (req, res) => {
  try {
    const parcelsRes = await db.execute(sql`SELECT id, name, ST_AsGeoJSON(geometry) as geometry, status, date, ada_parsel FROM parcels`);
    const structuresRes = await db.execute(sql`SELECT * FROM structures`);
    const entitiesRes = await db.execute(sql`SELECT * FROM entities`);
    const structureEntitiesRes = await db.execute(sql`SELECT * FROM structure_entities`);

    const formattedResult = parcelsRes.map((p: any) => {
      const pStructures = structuresRes
        .filter((s: any) => s.parcel_id === p.id)
        .map((s: any) => {
          // Bu binaya ait ilişki kayıtlarını bul
          const sLinks = structureEntitiesRes.filter((se: any) => se.structure_id === s.id);
          
          // İlişki kayıtları ile firma/kişi detaylarını birleştir
          const sOccupants = sLinks.map((link: any) => {
            const entityData = entitiesRes.find((e: any) => e.id === link.entity_id) || {};
            return {
              id: link.id,
              role: link.role,
              has_work_license: link.has_work_license,
              ...entityData // Firma adı, telefonu, TC/VKN'si vb. buraya dahil olur
            };
          });

          return { ...s, occupants: sOccupants };
        });

      return {
        ...p,
        geometry: JSON.parse(p.geometry),
        structures: pStructures
      };
    });
    
    res.json(formattedResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PARSEL EKLEME
app.post('/api/parcels', async (req, res) => {
  try {
    const { name, geometry, status, adaParsel } = req.body;
    const id = randomUUID();
    const geojsonStr = JSON.stringify(geometry);
    
    await db.execute(sql`
      INSERT INTO parcels (id, name, geometry, status, ada_parsel)
      VALUES (${id}, ${name}, ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}::json), 4326), ${status || 'Aktif'}, ${adaParsel || null})
    `);
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/parcels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Veritabanından parseli sil (ON DELETE CASCADE olduğu için içindeki binalar ve kişiler de otomatik silinir)
    await db.execute(sql`DELETE FROM parcels WHERE id = ${id}`);
    res.status(200).json({ message: 'Parsel başarıyla silindi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// YAPI (BİNA) EKLEME
app.post('/api/structures', async (req, res) => {
  try {
    const { parcel_id, name, building_type } = req.body;
    const id = randomUUID();
    await db.execute(sql`INSERT INTO structures (id, parcel_id, name, building_type) VALUES (${id}, ${parcel_id}, ${name}, ${building_type})`);
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// FİRMA/KİŞİ EKLEME
// SİSTEMDEKİ TÜM FİRMA/KİŞİLERİ GETİR (Listeden seçmek için)
app.get('/api/entities', async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT * FROM entities ORDER BY name ASC`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// YENİ FİRMA / KİŞİ OLUŞTUR (Sisteme yeni kayıt eklerken)
app.post('/api/entities', async (req, res) => {
  try {
    const { type, name, tc_vkn, tax_office, phone, email } = req.body;
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO entities (id, type, name, tc_vkn, tax_office, phone, email) 
      VALUES (${id}, ${type}, ${name}, ${tc_vkn}, ${tax_office}, ${phone}, ${email})
    `);
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// BİNAYA PAYDAŞ BAĞLA (Var olan veya yeni eklenen kişiyi binaya atarken)
app.post('/api/structure-entities', async (req, res) => {
  try {
    const { structure_id, entity_id, role, has_work_license } = req.body;
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO structure_entities (id, structure_id, entity_id, role, has_work_license) 
      VALUES (${id}, ${structure_id}, ${entity_id}, ${role}, ${has_work_license})
    `);
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== "production") {
  import('vite').then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
}

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => { console.log(`Server running on http://localhost:${PORT}`); });
}

export default app;