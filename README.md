# AssetFlow — IT Varlık Yönetim Sistemi

AssetFlow, donanım varlıklarını, yazılım lisanslarını ve zimmet kayıtlarını merkezi olarak yönetmek için geliştirilmiş kurumsal düzeyde bir IT Asset Management (ITAM) uygulamasıdır.

---

## Ekran Görüntüleri

| Dashboard | Varlıklar |
|-----------|-----------|
| ![Dashboard](screenshots/2.png) | ![Assets](screenshots/1.png) |

| Lisanslar | Zimmetler |
|-----------|-----------|
| ![Licenses](screenshots/3.png) | ![Assignments](screenshots/4.png) |

---

## İçindekiler

1. [Teknoloji Yığını](#teknoloji-yığını)
2. [Kurulum](#kurulum)
3. [Çevre Değişkenleri](#çevre-değişkenleri)
4. [Veritabanı](#veritabanı)
5. [Kullanıcı Rolleri](#kullanıcı-rolleri)
6. [Özellikler](#özellikler)
   - [Dashboard](#dashboard)
   - [Varlıklar (Assets)](#varlıklar-assets)
   - [Lisanslar](#lisanslar)
   - [Zimmetler (Assignments)](#zimmetler-assignments)
   - [Kullanıcılar](#kullanıcılar)
   - [Raporlar](#raporlar)
   - [Ayarlar](#ayarlar)
7. [İçe / Dışa Aktarma](#içe--dışa-aktarma)
8. [QR Kod](#qr-kod)
9. [API Referansı](#api-referansı)
10. [Veritabanı Şeması](#veritabanı-şeması)

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Dil | TypeScript |
| Stil | Tailwind CSS |
| ORM | Prisma v5 |
| Veritabanı | MySQL |
| Kimlik Doğrulama | NextAuth.js v4 (JWT, Credentials) |
| Veri Yönetimi | TanStack Query v5 |
| Validasyon | Zod |
| İkonlar | Lucide React |
| Excel/CSV | SheetJS (xlsx), PapaParse |
| QR Kod | react-qr-code |
| Şifre Hashleme | bcryptjs |

---

## Kurulum

### Gereksinimler

- Node.js 18+
- MySQL 8+
- npm / pnpm / yarn

### Hızlı Kurulum (Önerilen)

Tüm kurulum adımlarını otomatik olarak gerçekleştiren kurulum betiği kullanılabilir:

```bash
chmod +x setup.sh && ./setup.sh
```

Betik sırasıyla şunları yapar:
- Node.js 18+ ve paket yöneticisini kontrol eder
- Bağımlılıkları yükler (`npm/pnpm/yarn install`)
- `.env` dosyasını oluşturur ve `NEXTAUTH_SECRET` otomatik üretir
- `DATABASE_URL` ayarlanana kadar bekler
- Prisma client üretir ve migrasyonları çalıştırır
- İsteğe bağlı olarak seed verisi yükler (demo kategoriler + admin kullanıcı)

> **Varsayılan admin hesabı** (seed seçilirse):
> - E-posta: `admin@assetflow.local`
> - Şifre: `admin123!` — ilk girişte değiştirilmesi önerilir.

### Manuel Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Çevre değişkenlerini yapılandır
cp .env.example .env
# .env dosyasını düzenle (aşağıdaki tabloya bakın)

# 3. Veritabanını oluştur ve migrasyonları çalıştır
npm run db:migrate

# 4. Seed verisini yükle (opsiyonel)
npm run db:seed

# 5. Geliştirme sunucusunu başlat
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.

### Kullanışlı Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build |
| `npm run start` | Production sunucusu |
| `npm run db:migrate` | Migrasyon çalıştır |
| `npm run db:push` | Şemayı DB'ye direkt uygula (geliştirme) |
| `npm run db:studio` | Prisma Studio aç |
| `npm run db:seed` | Örnek veri yükle |

---

## Çevre Değişkenleri

`.env` dosyasında aşağıdaki değişkenler tanımlanmalıdır:

```env
# Veritabanı
DATABASE_URL="mysql://KULLANICI:SIFRE@localhost:3306/assetflow"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="openssl rand -base64 32 komutuyla üret"
```

Uygulama içi ayarlar (uyarı günleri, bildirim e-postaları, Entra ID) **Ayarlar** sayfasından yönetilebilir ve veritabanında `SystemSetting` tablosunda saklanır.

---

## Veritabanı

### Temel Modeller

```
Department    →  User[]
User          →  Assignment[] (zimmet alan), Assignment[] (zimmet oluşturan)
Category      →  Asset[], License[]
Asset         →  Assignment[]
License       →  Assignment[]
Assignment    →  Asset veya License (biri boş olmalı, ikisi dolu olamaz)
AuditLog      →  User (değişikliği yapan)
SystemSetting →  key/value çifti (uygulama yapılandırması)
```

### Varlık Durumları

| Durum | Açıklama |
|-------|----------|
| `AVAILABLE` | Atanmaya hazır |
| `DEPLOYED` | Kullanıcıya zimmetlenmiş |
| `UNDER_REPAIR` | Bakımda |
| `ARCHIVED` | Kullanım dışı |

> Bir varlık `DEPLOYED` durumdayken silinemez. Önce zimmet iade edilmelidir.

---

## Kullanıcı Rolleri

| Rol | Yetki |
|-----|-------|
| **ADMIN** | Tam erişim: tüm sayfalar, ayarlar, denetim günlükleri, kategori yönetimi |
| **MANAGER** | Varlık, lisans, zimmet ve kullanıcı yönetimi |
| **USER** | Yalnızca görüntüleme |

Rol bazlı kısıtlamalar tüm API rotalarında ve sayfa düzeyinde uygulanır.

---

## Özellikler

### Dashboard

Ana sayfada anlık sistem özeti görüntülenir:

- Toplam / Aktif / Mevcut / Bakımdaki varlık sayıları
- Toplam lisans / Dolmak üzere olan lisans sayıları
- Aktif zimmet sayısı
- Garantisi dolmak üzere olan varlıklar için uyarı bannerleri
- Süresi dolmak üzere olan lisanslar için uyarı bannerleri

Uyarı eşiği **Ayarlar > Genel** bölümünden yapılandırılabilir (varsayılan: 30 gün).

---

### Varlıklar (Assets)

**Listeleme & Filtreleme**
- Arama (isim, etiket, seri no)
- Durum filtresi (AVAILABLE / DEPLOYED / UNDER_REPAIR / ARCHIVED)
- Kategori filtresi
- Sütun bazlı sıralama
- Sayfalama (varsayılan: 20 kayıt/sayfa)
- Masaüstü: tablo görünümü | Mobil: kart görünümü

**Varlık Kaydı Alanları**

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| Varlık Etiketi | Evet | Benzersiz tanımlayıcı (ör. `PC-001`) |
| Seri No | Hayır | Benzersiz, opsiyonel |
| İsim | Evet | Açıklayıcı ad |
| Model / Üretici | Hayır | Donanım bilgisi |
| Kategori | Evet | HARDWARE kategorisi |
| Durum | Evet | Varsayılan: AVAILABLE |
| Satın Alma Tarihi | Hayır | |
| Garanti Bitiş | Hayır | Uyarı sistemi bu alana bakar |
| Maliyet | Hayır | Ondalıklı sayı |
| Konum | Hayır | Fiziksel konum |
| Notlar | Hayır | Serbest metin |

**Toplu İşlemler**
- Seçili varlıkların durumunu değiştir
- Seçili varlıkları sil (DEPLOYED olmayanlar)

**Varlık Detay Sayfası** (`/assets/[id]`)
- Tüm alan bilgileri
- Zimmet geçmişi (kime ne zaman verildi, ne zaman iade edildi)
- QR kod görüntüle / indir / yazdır

---

### Lisanslar

**Listeleme & Filtreleme**
- Arama (isim, satıcı)
- Koltuk kullanım oranı ilerleme çubuğu
- Süresi dolmak üzere uyarı göstergesi

**Lisans Kaydı Alanları**

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| İsim | Evet | Lisans adı |
| Lisans Anahtarı | Hayır | |
| Satıcı | Hayır | |
| Kategori | Evet | SOFTWARE kategorisi |
| Toplam Koltuk | Evet | Varsayılan: 1 |
| Son Kullanma | Hayır | Uyarı sistemi bu alana bakar |
| Abonelik mi? | Hayır | Yenileme takibi için |
| Maliyet | Hayır | |
| Notlar | Hayır | |

> Bir kullanıcıya lisans zimmetlendiğinde `availableSeats` otomatik azalır; iade edildiğinde artar.

---

### Zimmetler (Assignments)

**Zimmet Oluşturma**
- Varlık **veya** lisans seçilir (ikisi birden seçilemez)
- Kullanıcı seçilir
- Opsiyonel not eklenebilir

**Listeleme**
- Aktif zimmetler / Tüm zimmetler toggle
- Kullanıcı, varlık/lisans adına göre arama
- Tür filtresi (asset / license)
- Süre hesaplama (zimmet süresi otomatik gösterilir)

**Toplu İade**
- Birden fazla zimmet seçilerek tek seferde iade edilebilir

**İade İşlemi**
- İade edildiğinde varlık durumu `AVAILABLE`'a döner
- Lisans koltuğu serbest kalır
- Denetim kaydı oluşturulur

---

### Kullanıcılar

**Kullanıcı Kaydı**

| Alan | Zorunlu |
|------|---------|
| Ad Soyad | Evet |
| E-posta | Evet (benzersiz) |
| Şifre | Evet (min. 8 karakter) |
| Rol | Evet (ADMIN / MANAGER / USER) |
| Departman | Hayır |

**Toplu İşlemler**
- Seçili kullanıcıları aktifleştir / pasifleştir
- Seçili kullanıcılara departman ata

**Kullanıcı Detayı**
- Aktif zimmetler listesi
- Son giriş zamanı
- Aktif/pasif durumu

> Aktif zimmetleri bulunan kullanıcılar silinemez.

---

### Raporlar

Tüm dışa aktarma işlemleri **Excel (.xlsx)** veya **CSV** formatında sunulur:

| Rapor | İçerik |
|-------|--------|
| Varlık Raporu | Tüm varlıklar (durum, kategori, garanti bilgileri) |
| Lisans Raporu | Tüm lisanslar (koltuk kullanımı, son kullanma) |
| Aktif Zimmetler | Şu an devam eden zimmetler |
| Tam Zimmet Geçmişi | İade edilenler dahil tüm zimmet kayıtları |

Ayrıca sayfanın üstünde anlık sayısal özet (snapshot istatistikler) görüntülenir.

---

### Ayarlar

> Yalnızca **ADMIN** rolü erişebilir.

**Genel**
- Uygulama adı
- Garanti uyarı eşiği (gün cinsinden, varsayılan: 30)

**Kategoriler**
- HARDWARE ve SOFTWARE kategorileri oluştur / düzenle / sil
- Kullanımda olan kategoriler silinemez

**Denetim Günlükleri**
- Tüm sistem olaylarının kaydı (CREATED, UPDATED, DELETED, ASSIGNED, RETURNED, STATUS_CHANGED)
- Entity türü ve aksiyona göre filtreleme
- IP adresi ve tarayıcı bilgisi kaydedilir

**Entra ID**
- Azure AD / Microsoft Entra ID entegrasyonu için tenant ve client kimlik bilgileri

**Bildirimler**
- E-posta bildirimleri açma/kapama
- Bildirim alıcısı ve göndericisi
- Kaç gün önce bildirim gönderileceği

---

## İçe / Dışa Aktarma

### Toplu İçe Aktarma (Import)

**Desteklenen formatlar:** `.xlsx`, `.csv`

**Şablon indirme:** Her içe aktarma ekranında "Şablon İndir" butonu ile pre-doldurulmuş Excel şablonu alınabilir.

| Sayfa | Endpoint | Şablon |
|-------|----------|--------|
| Varlıklar | `POST /api/assets/import` | `GET /api/templates/assets` |
| Lisanslar | `POST /api/licenses/import` | `GET /api/templates/licenses` |

**İçe aktarma davranışı:**
- Aynı varlık etiketine sahip kayıtlar atlanır (duplicate skip)
- Kategori adı, ID yerine otomatik çözümlenir
- Satır bazlı hata raporu döner: `{created, skipped, skippedTags, validationErrors}`

### Toplu Dışa Aktarma (Export)

Varlık ve zimmet listelerinde aktif filtreler dışa aktarıma yansır.

---

## QR Kod

Her varlık için QR kod oluşturulabilir:

1. Varlık listesinde QR ikonuna tıkla
2. Veya varlık detay sayfasından `QR Kodu Görüntüle` butonuna tıkla

**Seçenekler:**
- **PNG İndir** — Canvas üzerinden yüksek çözünürlüklü PNG
- **Yazdır** — Tarayıcı yazdırma diyalogu

QR kod içeriği: varlığa doğrudan bağlantı URL'si.

---

## API Referansı

Tüm API rotaları `/api/` altındadır. Oturum gerektiren rotalar NextAuth JWT ile doğrulanır.

### Varlıklar

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/assets` | Listele (search, status, categoryId, page, pageSize, sortBy, sortDir) |
| POST | `/api/assets` | Oluştur |
| GET | `/api/assets/:id` | Detay + zimmet geçmişi |
| PUT | `/api/assets/:id` | Güncelle |
| DELETE | `/api/assets/:id` | Soft-delete (DEPLOYED ise engeller) |
| POST | `/api/assets/import` | Toplu içe aktar (multipart/form-data) |
| GET | `/api/assets/export` | Dışa aktar (format: xlsx\|csv) |
| PATCH | `/api/assets/bulk` | Toplu durum değiştir |
| DELETE | `/api/assets/bulk` | Toplu sil |

### Lisanslar

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/licenses` | Listele |
| POST | `/api/licenses` | Oluştur |
| GET | `/api/licenses/:id` | Detay + aktif zimmetler |
| PUT | `/api/licenses/:id` | Güncelle |
| DELETE | `/api/licenses/:id` | Sil (aktif zimmet varsa engeller) |
| POST | `/api/licenses/import` | Toplu içe aktar |

### Zimmetler

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/assignments` | Listele (userId, active, type, search) |
| POST | `/api/assignments` | Zimmet oluştur |
| GET | `/api/assignments/:id` | Detay |
| PATCH | `/api/assignments/:id` | İade et |
| PATCH | `/api/assignments/bulk-return` | Toplu iade |
| GET | `/api/assignments/export` | Dışa aktar |
| GET | `/api/assignments/stats` | Hızlı istatistik |

### Kategoriler

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/categories` | Listele (type: HARDWARE\|SOFTWARE) |
| POST | `/api/categories` | Oluştur (ADMIN) |
| PATCH | `/api/categories/:id` | Güncelle (ADMIN) |
| DELETE | `/api/categories/:id` | Sil (ADMIN, kullanımda değilse) |

### Kullanıcılar

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/users` | Listele (search, departmentId, status) |
| POST | `/api/users` | Oluştur |
| GET | `/api/users/:id` | Detay + aktif zimmetler |
| PATCH | `/api/users/:id` | Güncelle |
| DELETE | `/api/users` | Toplu sil |
| PATCH | `/api/users/bulk` | Toplu aktif/pasif/departman |

### Diğer

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/dashboard` | Özet istatistikler |
| GET | `/api/departments` | Departman listesi |
| GET | `/api/reports/assets` | Varlık raporu indir |
| GET | `/api/reports/licenses` | Lisans raporu indir |
| GET | `/api/reports/assignments` | Zimmet raporu indir |
| GET | `/api/templates/assets` | İçe aktarma şablonu |
| GET | `/api/templates/licenses` | İçe aktarma şablonu |
| GET | `/api/settings/general` | Genel ayarları oku (ADMIN) |
| PUT | `/api/settings/general` | Genel ayarları kaydet (ADMIN) |
| GET | `/api/settings/audit-logs` | Denetim günlükleri (ADMIN) |

---

## Veritabanı Şeması

```
Department
  id, name (unique), description, createdAt, updatedAt
  → users[]

User
  id, name, email (unique), password (bcrypt), role, isActive
  departmentId?, location?, lastLoginAt?, createdAt, updatedAt
  → assignments[], assignmentsCreated[], auditLogs[]

Category
  id, name (unique), type (HARDWARE|SOFTWARE), description, createdAt
  → assets[], licenses[]

Asset
  id, assetTag (unique), serialNumber? (unique), name, model?, manufacturer?
  categoryId, status, purchaseDate?, warrantyExpiry?, purchaseCost?
  location?, notes?, deletedAt? (soft-delete), createdAt, updatedAt
  → assignments[]

License
  id, name, licenseKey?, vendor?, categoryId
  totalSeats, availableSeats, expirationDate?, isSubscription
  purchaseCost?, notes?, deletedAt? (soft-delete), createdAt, updatedAt
  → assignments[]

Assignment
  id, assetId? XOR licenseId?, userId, assignedBy
  assignedAt, returnedAt?, notes?
  → asset, license, user, createdBy

AuditLog
  id, entityType, entityId, action, changedBy
  oldValue? (JSON), newValue? (JSON), ipAddress?, userAgent?, createdAt

SystemSetting
  key (PK), value, updatedAt
```

---

*AssetFlow — Kurumsal IT Varlık Yönetimi*
