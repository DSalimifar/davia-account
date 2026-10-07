using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using DaviaAccount.Api.Data;
using DaviaAccount.Api.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
}

app.MapGet("/api/health", () => Results.Ok(new { ok = true, app = "DaviaAccount" }));

app.MapPost("/api/auth/register", async (RegisterRequest req, AppDbContext db) =>
{
    if (await db.Users.AnyAsync(x => x.Username == req.Username))
        return Results.Conflict(new { message = "نام کاربری قبلاً ثبت شده است." });

    var company = new Company { Name = req.CompanyName.Trim() };
    var user = new User
    {
        Company = company,
        Username = req.Username.Trim(),
        FullName = req.FullName.Trim(),
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
    };

    db.Companies.Add(company);
    db.Users.Add(user);
    await db.SaveChangesAsync();

    var role = new Role { CompanyId = company.Id, Name = "مدیر" };
    db.Roles.Add(role);
    await db.SaveChangesAsync();

    db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "حساب ایجاد شد." });
});

app.MapPost("/api/auth/login", async (LoginRequest req, AppDbContext db, IConfiguration cfg) =>
{
    var user = await db.Users.FirstOrDefaultAsync(x => x.Username == req.Username && x.IsActive);
    if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        return Results.Unauthorized();

    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim("companyId", user.CompanyId.ToString()),
        new Claim("username", user.Username)
    };

    var creds = new SigningCredentials(
        new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!)),
        SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        cfg["Jwt:Issuer"], cfg["Jwt:Audience"], claims,
        expires: DateTime.UtcNow.AddMinutes(int.Parse(cfg["Jwt:Minutes"] ?? "60")),
        signingCredentials: creds);

    user.LastLoginAt = DateTime.UtcNow;
    await db.SaveChangesAsync();

    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
});

app.MapGet("/api/customers", async (ClaimsPrincipal cp, AppDbContext db) =>
{
    var companyId = int.Parse(cp.FindFirstValue("companyId")!);
    return Results.Ok(await db.Customers.Where(x => x.CompanyId == companyId && x.IsActive)
        .OrderBy(x => x.Name).ToListAsync());
}).RequireAuthorization();

app.MapPost("/api/customers", async (ClaimsPrincipal cp, CustomerRequest req, AppDbContext db) =>
{
    var companyId = int.Parse(cp.FindFirstValue("companyId")!);
    var item = new Customer { CompanyId = companyId, Name = req.Name.Trim(), Mobile = req.Mobile, NationalId = req.NationalId };
    db.Customers.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/customers/{item.Id}", item);
}).RequireAuthorization();

app.MapGet("/api/products", async (ClaimsPrincipal cp, AppDbContext db) =>
{
    var companyId = int.Parse(cp.FindFirstValue("companyId")!);
    return Results.Ok(await db.Products.Where(x => x.CompanyId == companyId && x.IsActive)
        .OrderBy(x => x.Name).ToListAsync());
}).RequireAuthorization();

app.MapPost("/api/products", async (ClaimsPrincipal cp, ProductRequest req, AppDbContext db) =>
{
    var companyId = int.Parse(cp.FindFirstValue("companyId")!);
    var item = new Product { CompanyId = companyId, Code = req.Code, Name = req.Name.Trim(), Barcode = req.Barcode, SalePrice = req.SalePrice };
    db.Products.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/products/{item.Id}", item);
}).RequireAuthorization();

app.MapGet("/api/invoices", async (ClaimsPrincipal cp, AppDbContext db) =>
{
    var companyId = int.Parse(cp.FindFirstValue("companyId")!);
    return Results.Ok(await db.SalesInvoices
        .Include(x => x.Customer)
        .Where(x => x.CompanyId == companyId)
        .OrderByDescending(x => x.Id)
        .Take(100).ToListAsync());
}).RequireAuthorization();

app.MapPost("/api/invoices", async (ClaimsPrincipal cp, InvoiceRequest req, AppDbContext db) =>
{
    var companyId = int.Parse(cp.FindFirstValue("companyId")!);
    var invoice = new SalesInvoice
    {
        CompanyId = companyId,
        CustomerId = req.CustomerId,
        InvoiceDate = req.InvoiceDate ?? DateTime.UtcNow,
        Status = "Issued",
        Description = req.Description,
        CreatedBy = int.Parse(cp.FindFirstValue(ClaimTypes.NameIdentifier) ?? cp.FindFirstValue("sub")!)
    };

    foreach (var line in req.Items)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId && p.CompanyId == companyId);
        if (product is null) return Results.BadRequest(new { message = "کالا معتبر نیست." });
        invoice.Items.Add(new SalesInvoiceItem
        {
            ProductId = product.Id,
            Description = line.Description ?? product.Name,
            Quantity = line.Quantity,
            UnitPrice = line.UnitPrice ?? product.SalePrice
        });
    }

    invoice.Subtotal = invoice.Items.Sum(x => x.Quantity * x.UnitPrice);
    invoice.Discount = req.Discount;
    invoice.Tax = req.Tax;
    invoice.Total = invoice.Subtotal - invoice.Discount + invoice.Tax;

    invoice.InvoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100,999)}";
    db.SalesInvoices.Add(invoice);
    await db.SaveChangesAsync();

    db.AuditLogs.Add(new AuditLog
    {
        CompanyId = companyId,
        UserId = int.Parse(cp.FindFirstValue("sub")!),
        Action = "CREATE",
        EntityType = "SalesInvoice",
        EntityId = invoice.Id,
        CreatedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Ok(invoice);
}).RequireAuthorization();

app.Run();

record RegisterRequest(string CompanyName, string FullName, string Username, string Password);
record LoginRequest(string Username, string Password);
record CustomerRequest(string Name, string? Mobile, string? NationalId);
record ProductRequest(string Code, string Name, string? Barcode, decimal SalePrice);
record InvoiceLineRequest(int ProductId, decimal Quantity, decimal? UnitPrice, string? Description);
record InvoiceRequest(int? CustomerId, DateTime? InvoiceDate, decimal Discount, decimal Tax, string? Description, List<InvoiceLineRequest> Items);
