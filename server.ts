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


// TÜM VERİLERİ İÇ İÇE (NESTED) GETİR - İMAR VE RUHSAT EKLENTİLİ
app.get('/api/parcels', async (req, res) => {
  try {
    const parcelsRes = await db.execute(sql`SELECT id, name, ST_AsGeoJSON(geometry) as geometry, status, date, ada_parsel, zoning_status, area_m2 FROM parcels`);
    const structuresRes = await db.execute(sql`SELECT * FROM structures`);
    const unitsRes = await db.execute(sql`SELECT * FROM independent_units ORDER BY unit_no ASC`);
    const entitiesRes = await db.execute(sql`SELECT * FROM entities`);
    const unitEntitiesRes = await db.execute(sql`SELECT * FROM unit_entities`); 
    const parcelEntitiesRes = await db.execute(sql`SELECT * FROM parcel_entities`);
    
    // YENİ: İmar ve Ruhsat verilerini veritabanından çek
    const zoningRes = await db.execute(sql`SELECT * FROM zoning_details`);
    const licensesRes = await db.execute(sql`SELECT * FROM licenses`);

    const formattedResult = parcelsRes.map((p: any) => {
      // Parsel Sahipleri (Arsa Malikleri)
      const pLinks = parcelEntitiesRes.filter((pe: any) => pe.parcel_id === p.id);
      const pOwners = pLinks.map((link: any) => {
        const entityData = entitiesRes.find((e: any) => e.id === link.entity_id) || {};
        return { ...entityData, entity_id: entityData.id, id: link.id, share_percentage: link.share_percentage };
      });
      
      // YENİ: Parselin İmar Detaylarını Eşleştir
      const pZoningDetails = zoningRes.find((z: any) => z.parcel_id === p.id) || null;
      
      // YENİ: Bu Parsele ait Ruhsat Başvurularını (Örn: Yapı Ruhsatı, İskan) Eşleştir
      const pLicenses = licensesRes.filter((l: any) => l.reference_id === p.id && l.reference_type === 'parcel');

      // Binalar ve Bağımsız Bölümler
      const pStructures = structuresRes
        .filter((s: any) => s.parcel_id === p.id)
        .map((s: any) => {
          const sUnits = unitsRes.filter((u: any) => u.structure_id === s.id).map((u: any) => {
             const uLinks = unitEntitiesRes.filter((ue: any) => ue.unit_id === u.id);
             const uOccupants = uLinks.map((link: any) => {
                const entityData = entitiesRes.find((e: any) => e.id === link.entity_id) || {};
                return { ...entityData, entity_id: entityData.id, id: link.id, role: link.role, has_work_license: link.has_work_license };
             });
             
             // YENİ: Bu Bağımsız Bölüme ait Ruhsat Başvurularını (Örn: GSM Ruhsatı) Eşleştir
             const uLicenses = licensesRes.filter((l: any) => l.reference_id === u.id && l.reference_type === 'unit');
             
             return { ...u, occupants: uOccupants, licenses: uLicenses };
          });

          return { ...s, units: sUnits };
        });

      return {
        ...p,
        geometry: p.geometry ? JSON.parse(p.geometry) : null,
        structures: pStructures,
        owners: pOwners,
        zoning_details: pZoningDetails,
        licenses: pLicenses
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

  // YENİ: İMAR DURUMU PARAMETRELERİNİ KAYDET/GÜNCELLE
app.post('/api/zoning-details', async (req, res) => {
  try {
    const { parcel_id, taks, kaks, hmax, front_setback, side_setback, rear_setback } = req.body;
    
    // Önce bu parsele ait kayıt var mı kontrol et
    const existing = await db.execute(sql`SELECT id FROM zoning_details WHERE parcel_id = ${parcel_id}`);
    
    if (existing.length > 0) {
      // Varsa Güncelle (Update)
      await db.execute(sql`
        UPDATE zoning_details 
        SET taks=${taks}, kaks=${kaks}, hmax=${hmax}, front_setback=${front_setback}, side_setback=${side_setback}, rear_setback=${rear_setback}
        WHERE parcel_id = ${parcel_id}
      `);
      res.status(200).json({ message: "İmar detayları güncellendi." });
    } else {
      // Yoksa Yeni Kayıt Oluştur (Insert)
      const id = randomUUID();
      await db.execute(sql`
        INSERT INTO zoning_details (id, parcel_id, taks, kaks, hmax, front_setback, side_setback, rear_setback) 
        VALUES (${id}, ${parcel_id}, ${taks}, ${kaks}, ${hmax}, ${front_setback}, ${side_setback}, ${rear_setback})
      `);
      res.status(201).json({ id });
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// YENİ: RUHSAT BAŞVURUSU (İŞ AKIŞI) OLUŞTUR
app.post('/api/licenses', async (req, res) => {
  try {
    const { reference_id, reference_type, license_type, status, notes } = req.body;
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO licenses (id, reference_id, reference_type, license_type, status, notes) 
      VALUES (${id}, ${reference_id}, ${reference_type}, ${license_type}, ${status || 'Bekliyor'}, ${notes || null})
    `);
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