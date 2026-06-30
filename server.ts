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

    // OSB İmar biriminin "İmar Durum Belgesi" verebilmesi için gerekli teknik parametreler
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zoning_details (
        id UUID PRIMARY KEY,
        parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
        taks NUMERIC DEFAULT 0,          -- Taban Alanı Katsayısı (Örn: 0.55)
        kaks NUMERIC DEFAULT 0,          -- Emsal / Kat Alanı Katsayısı (Örn: 0.70)
        hmax NUMERIC DEFAULT 0,          -- Maksimum Yükseklik (metre cinsinden, Örn: 15.50)
        front_setback NUMERIC DEFAULT 0, -- Ön Bahçe Çekme Mesafesi
        side_setback NUMERIC DEFAULT 0,  -- Yan Bahçe Çekme Mesafesi
        rear_setback NUMERIC DEFAULT 0   -- Arka Bahçe Çekme Mesafesi
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

    // 3. BAĞIMSIZ BÖLÜMLER TABLOSU (YENİ EKLENDİ)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS independent_units (
        id UUID PRIMARY KEY,
        structure_id UUID REFERENCES structures(id) ON DELETE CASCADE,
        name TEXT,
        unit_no TEXT
      );
    `);

    // 4. MERKEZİ PAYDAŞLAR (KİŞİ/FİRMA) TABLOSU
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

    // 5. BAĞIMSIZ BÖLÜM - PAYDAŞ İLİŞKİ TABLOSU (YENİ: Ruhsat ve Kiracılık buraya bağlandı)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS unit_entities (
        id UUID PRIMARY KEY,
        unit_id UUID REFERENCES independent_units(id) ON DELETE CASCADE,
        entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
        role TEXT,
        has_work_license BOOLEAN DEFAULT false
      );
    `);

    // 6. PARSEL - PAYDAŞ İLİŞKİ TABLOSU (Arsa sahipleri)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parcel_entities (
        id UUID PRIMARY KEY,
        parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
        entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
        share_percentage NUMERIC DEFAULT 100
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS licenses (
        id UUID PRIMARY KEY,
        reference_id UUID NOT NULL,               -- Parsel ID veya Bağımsız Bölüm ID gelebilir
        reference_type TEXT NOT NULL,             -- 'parcel', 'structure' veya 'unit'
        license_type TEXT NOT NULL,               -- 'İmar Durum Belgesi', 'Yapı Ruhsatı', 'İskan', 'GSM Ruhsatı'
        application_date TIMESTAMP DEFAULT NOW(), -- Başvuru Tarihi
        approval_date TIMESTAMP,                  -- Onay Tarihi
        status TEXT DEFAULT 'Bekliyor',           -- 'Bekliyor', 'Eksik Evrak', 'Onaylandı', 'Reddedildi'
        notes TEXT                                -- Eksik evrak notları veya uyarılar
      );
    `);
    
    await db.execute(sql`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS ada_parsel TEXT;`);
    console.log("PostgreSQL İlişkisel Tablo yapısı başarıyla hazırlandı (Bağımsız Bölüm Mimarisi).");
  } catch (err: any) {
    console.error("Veritabanı otomatik kurulum hatası:", err.message);
  }
}
initDatabase();

// TÜM VERİLERİ İÇ İÇE (NESTED) GETİR - GÜNCELLENDİ
app.get('/api/parcels', async (req, res) => {
  try {
    const parcelsRes = await db.execute(sql`SELECT id, name, ST_AsGeoJSON(geometry) as geometry, status, date, ada_parsel FROM parcels`);
    const structuresRes = await db.execute(sql`SELECT * FROM structures`);
    const unitsRes = await db.execute(sql`SELECT * FROM independent_units ORDER BY unit_no ASC`);
    const entitiesRes = await db.execute(sql`SELECT * FROM entities`);
    const unitEntitiesRes = await db.execute(sql`SELECT * FROM unit_entities`); 
    const parcelEntitiesRes = await db.execute(sql`SELECT * FROM parcel_entities`); 

    const formattedResult = parcelsRes.map((p: any) => {
      // 1. Doğrudan Parselin Sahiplerini (Arsa Maliklerini) Bul
      const pLinks = parcelEntitiesRes.filter((pe: any) => pe.parcel_id === p.id);
      const pOwners = pLinks.map((link: any) => {
        const entityData = entitiesRes.find((e: any) => e.id === link.entity_id) || {};
        return { ...entityData, entity_id: entityData.id, id: link.id, share_percentage: link.share_percentage };
      });

      // 2. Binaları ve İçindeki Bağımsız Bölümleri Bul
      const pStructures = structuresRes
        .filter((s: any) => s.parcel_id === p.id)
        .map((s: any) => {
          // Binanın içindeki bağımsız bölümleri bul
          const sUnits = unitsRes.filter((u: any) => u.structure_id === s.id).map((u: any) => {
             // Bağımsız bölümdeki kiracı/malikleri bul
             const uLinks = unitEntitiesRes.filter((ue: any) => ue.unit_id === u.id);
             const uOccupants = uLinks.map((link: any) => {
                const entityData = entitiesRes.find((e: any) => e.id === link.entity_id) || {};
                return { ...entityData, entity_id: entityData.id, id: link.id, role: link.role, has_work_license: link.has_work_license };
             });
             return { ...u, occupants: uOccupants };
          });

          return { ...s, units: sUnits }; // units (bağımsız bölümler) binaya eklendi
        });

      return {
        ...p,
        geometry: JSON.parse(p.geometry),
        structures: pStructures,
        owners: pOwners 
      };
    });
    
    res.json(formattedResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PARSEL SİLME VE EKLEME API'LERİ AYNI
app.post('/api/parcels', async (req, res) => {
  try {
    const { name, geometry, status, adaParsel } = req.body;
    const id = randomUUID();
    const geojsonStr = JSON.stringify(geometry);
    await db.execute(sql`INSERT INTO parcels (id, name, geometry, status, ada_parsel) VALUES (${id}, ${name}, ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}::json), 4326), ${status || 'Aktif'}, ${adaParsel || null})`);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/parcels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM parcels WHERE id = ${id}`);
    res.status(200).json({ message: 'Parsel başarıyla silindi' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/structures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM structures WHERE id = ${id}`);
    res.status(200).json({ message: 'Yapı başarıyla silindi' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// BAĞIMSIZ BÖLÜM SİLME
app.delete('/api/independent-units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM independent_units WHERE id = ${id}`);
    res.status(200).json({ message: 'Bağımsız bölüm başarıyla silindi' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// BAĞIMSIZ BÖLÜM - KİRACI/MALİK İLİŞKİSİNİ SİLME (Birimden çıkarma)
app.delete('/api/unit-entities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM unit_entities WHERE id = ${id}`);
    res.status(200).json({ message: 'Paydaş birimden başarıyla çıkarıldı' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PARSEL - MALİK İLİŞKİSİNİ SİLME (Arsa Hissedarını çıkarma)
app.delete('/api/parcel-entities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM parcel_entities WHERE id = ${id}`);
    res.status(200).json({ message: 'Arsa maliki başarıyla çıkarıldı' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// YAPI (BİNA) EKLEME
app.post('/api/structures', async (req, res) => {
  try {
    const { parcel_id, name, building_type } = req.body;
    const id = randomUUID();
    await db.execute(sql`INSERT INTO structures (id, parcel_id, name, building_type) VALUES (${id}, ${parcel_id}, ${name}, ${building_type})`);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// BAĞIMSIZ BÖLÜM EKLEME (YENİ)
app.post('/api/independent-units', async (req, res) => {
    try {
      const { structure_id, name, unit_no } = req.body;
      const id = randomUUID();
      await db.execute(sql`INSERT INTO independent_units (id, structure_id, name, unit_no) VALUES (${id}, ${structure_id}, ${name}, ${unit_no})`);
      res.status(201).json({ id });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

// SİSTEMDEKİ TÜM FİRMA/KİŞİLERİ GETİR VE EKLE
app.get('/api/entities', async (req, res) => {
  try { const result = await db.execute(sql`SELECT * FROM entities ORDER BY name ASC`); res.json(result); } 
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/entities', async (req, res) => {
  try {
    const { type, name, tc_vkn, tax_office, phone, email } = req.body;
    const id = randomUUID();
    await db.execute(sql`INSERT INTO entities (id, type, name, tc_vkn, tax_office, phone, email) VALUES (${id}, ${type}, ${name}, ${tc_vkn}, ${tax_office}, ${phone}, ${email})`);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PARSELE ARSA SAHİBİ (MALİK) BAĞLA
app.post('/api/parcel-entities', async (req, res) => {
  try {
    const { parcel_id, entity_id, share_percentage } = req.body;
    const id = randomUUID();
    await db.execute(sql`INSERT INTO parcel_entities (id, parcel_id, entity_id, share_percentage) VALUES (${id}, ${parcel_id}, ${entity_id}, ${share_percentage || 100})`);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// BAĞIMSIZ BÖLÜME KİRACI/MALİK BAĞLA (YENİ)
app.post('/api/unit-entities', async (req, res) => {
    try {
      const { unit_id, entity_id, role, has_work_license } = req.body;
      const id = randomUUID();
      await db.execute(sql`INSERT INTO unit_entities (id, unit_id, entity_id, role, has_work_license) VALUES (${id}, ${unit_id}, ${entity_id}, ${role}, ${has_work_license})`);
      res.status(201).json({ id });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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