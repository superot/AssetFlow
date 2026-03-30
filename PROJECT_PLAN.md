# Role: Lead Full-Stack Architect & ITAM Expert
Sen, kurumsal ölçekte IT Varlık Yönetimi (ITAM) sistemleri geliştiren bir Kıdemli Yazılım Mimarı ve Full-Stack Developersın. 

# Project Goal: "AssetFlow"
Donanım (Hardware), Yazılım Lisansı (Software License) ve Kullanıcı Zimmet (Assignment) süreçlerini uçtan uca yöneten, mobil uyumlu (responsive) ve ölçeklenebilir bir web uygulaması geliştireceğiz.

# Technical Stack:
- **Frontend:** Next.js 14+ (App Router), Tailwind CSS, TanStack Query (React Query).
- **Backend:** Node.js + Prisma ORM.
- **Database:** MySQL (İlişkisel bütünlük ve denetim izi kritik).
- **Authentication:** NextAuth.js veya Clerk (SSO desteği için).
- **UI Library:** Lucide Icons + Shadcn UI (veya Radix UI).

# Database Requirements (MySQL & Prisma):
Aşağıdaki tablolar ve ilişkiler kurulmalıdır:
1. **Departments & Users:** Şirket hiyerarşisi. Kullanici ve departman bilgisi EntraID uzerinden gelmeli.
2. **Categories:** (Laptop, Desktop, Mobile Phone, Tablet, Peripheral, Software vb.)
3. **Assets (Donanım):** Serial Number, Asset Tag (QR), Model, Status (Enum: AVAILABLE, DEPLOYED, UNDER_REPAIR, ARCHIVED), Purchase Date, Warranty Expiry.
4. **Licenses (Yazılım):** License Key, Seats (Total/Available), Expiration Date, IsSubscription.
5. **Assignments (Zimmet):** Bir varlığın (Asset veya License) bir kullanıcıya atanma geçmişi. `assigned_at` ve `returned_at` takibi.
6. **AuditLogs:** Kritik statü değişikliklerini (kim, neyi, ne zaman değiştirdi) tutan tablo.

# Project Scope (Phase by Phase):
Senden bu projeyi şu aşamalarla inşa etmeni bekliyorum:

- **Phase 1: Mimari ve Veritabanı:** MySQL şemasının (schema.prisma) oluşturulması, TypeScript tiplerinin tanımlanması ve Next.js klasör yapısının (Feature-based) kurulması.
- **Phase 2: API & Business Logic:** CRUD operasyonları, Zimmetleme mantığı (Transaction yönetimi: Cihaz atandığında statüsü otomatik DEPLOYED olmalı) ve Soft-Delete yapısı.
- **Phase 3: Responsive UI & Dashboard:** Desktop için detaylı tablolar, Mobil için kart yapıları. Garanti süresi azalanlar için görsel uyarılar.
- **Phase 4: Advanced Features:** QR Kod üretme mantığı, CSV/Excel ile toplu varlık aktarımı (Import) ve Raporlama.

# Instructions for First Step:
Lütfen şimdi sadece **Phase 1**'e odaklan. 
1. MySQL için optimize edilmiş, ilişkisel bütünlüğü (Foreign Keys) tam olan kapsamlı bir `schema.prisma` hazırla.
2. Projenin Next.js App Router yapısındaki klasör hiyerarşisini (Architecture) göster.
3. Temel `types/index.ts` dosyasını oluştur.

Kodları temiz, modüler ve "Clean Code" prensiplerine uygun şekilde yazmaya başla.