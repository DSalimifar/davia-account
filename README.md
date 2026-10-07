# DAVIA ACCOUNT — داویا حساب

نسخه پایه وب چندکاربره و چندشرکتی **DAVIA ACCOUNT**.

> این بسته نسخه اول قابل توسعه است؛ محصول نهایی حسابداری نیست. هدف V1 ساخت هسته‌ای سالم برای توسعه ماژول‌های بعدی است.

## معماری
- Backend: ASP.NET Core 8 Web API
- Database: PostgreSQL 16
- ORM: Entity Framework Core + Npgsql
- Authentication: JWT
- Frontend: React 18 + Vite
- PWA: Manifest + DAVIA brand assets
- Docker Compose برای PostgreSQL
- API مشترک برای Web و Android آینده
- RTL / فارسی
- Multi-tenant پایه با CompanyId

## امکانات V1
- ثبت‌نام شرکت و کاربر مدیر
- ورود و خروج
- داشبورد پایه
- اشخاص/مشتریان
- کالا و خدمات
- فاکتور فروش پایه
- Audit Log پایه
- Health endpoint
- PWA و آیکون‌های DAVIA

## استاندارد رابط کاربری
- Safe Area و System UI در موبایل
- عدم قرارگیری محتوا زیر Status Bar / Navigation Bar
- اسکرول امن صفحات
- `env(safe-area-inset-*)`
- فضای پایین مناسب هنگام باز شدن Keyboard
- فرم‌ها و دکمه‌های انتهایی با Keyboard باز نیز قابل مشاهده و لمس باشند

## اجرای محلی

### PostgreSQL
```bash
docker compose up -d db
```

### Backend
```bash
cd backend/DaviaAccount.Api
dotnet restore
dotnet run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

`VITE_API_URL` در صورت نیاز برای آدرس API قابل تنظیم است.

## GitHub Actions
Workflow با نام **Build DAVIA ACCOUNT** روی push به `main` و اجرای دستی فعال است.

## نکته امنیتی
JWT Key و Connection String واقعی را در production داخل Environment/Secrets قرار دهید. مقادیر فایل نمونه فقط برای توسعه هستند.

## مسیر توسعه بعدی
1. EF Core Migrations به جای EnsureCreated
2. Refresh Token و Logout/Revoke
3. Permissionهای ریزدانه
4. مدیریت کاربران و نقش‌ها
5. فاکتور فروش حرفه‌ای
6. خرید و برگشت‌ها
7. دریافت/پرداخت
8. انبار
9. حسابداری دوبل
10. چک و اقساط
11. گزارش‌ها و PDF فارسی
12. تست خودکار و امنیت production
